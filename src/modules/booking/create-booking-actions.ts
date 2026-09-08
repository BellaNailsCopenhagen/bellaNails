"use server"

import { revalidatePath } from "next/cache"

import {
  countActiveUpcomingBookingsForClient,
  insertBooking,
} from "@/db/bookings"
import { takeDurableToken } from "@/db/rate-limits"
import { updateClientCommunicationLocale } from "@/db/clients"
import { resolveLocale, type Locale } from "@/i18n/routing"
import {
  getAvailableSlots,
  getOutsideSlots,
  getOverrideSlots,
} from "@/modules/booking/availability"
import {
  buildBookingDraft,
  type BookingDraft,
} from "@/modules/booking/booking-draft"
import { manageUrlFor } from "@/modules/booking/manage-token"
import {
  callerIp,
  checkBlocked,
  getBookingProtectionSettings,
} from "@/modules/booking/protection"
import { MAX_ACTIVE_BOOKINGS } from "@/shared/booking-policy"
import type { Slot } from "@/shared/booking-slots"
import { serviceRef, type SubjectRef } from "@/shared/booking-subject"
import { fetchClientContacts } from "@/modules/clients"
import { ensureUser } from "@/modules/identity/ensure-user"
import {
  humanCheckConfigured,
  spendHumanProof,
  verifyHumanProof,
} from "@/modules/identity/human-check"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"

import { sendBookingConfirmationEmail } from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { recordTermsAcceptance } from "@/modules/terms/acceptance"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { requiresVerifiedIdentity } from "@/shared/booking-protection"
import { EMAIL_PATTERN, toE164 } from "@/shared/contact-validation"
import { routes, revalidatePatterns } from "@/shared/routes"

// Generous enough that a real person rebooking after a cancellation never
// notices, tight enough that one validated account can't churn the calendar.
// Durable (Postgres), because the in-process limiter is per instance.
const CREATE_RULE = { limit: 10, window: "1 hour" }

export type CreateBookingInput = {
  serviceId: string
  addonIds: string[]
  start: string // ISO UTC — a slot from getAvailableSlots
  name: string
  /** Only read when "require a sign-in to book" is OFF — otherwise the session
      owns the address and this is ignored. */
  email?: string
  phone?: string
  notes?: string
  locale?: string
  /** Honeypot — a hidden form field; a non-empty value means a bot filled it. */
  honeypot?: string
  /** Solved "I'm not a robot" proof, when the check is switched on. */
  humanProof?: string
}

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: "cap" | "auth" | "human" }

// The client's confirmation email — best-effort (the sender swallows errors).
async function sendConfirmation(
  draft: BookingDraft,
  bookingId: string,
  clientId: string,
  to: string,
  firstName: string | null,
  startIso: string,
  locale: Locale,
): Promise<void> {
  const isEn = locale === "en"
  const { subject } = draft
  const res = await sendBookingConfirmationEmail({
    to,
    firstName,
    serviceName: isEn ? subject.nameEn : subject.nameDk ?? subject.nameEn,
    addonNames: subject.addons.map((a) =>
      isEn ? a.name_en : a.name_dk ?? a.name_en,
    ),
    startIso,
    endIso: draft.endIso,
    priceCents: subject.priceCents,
    manageUrl: manageUrlFor(locale, bookingId),
    bookingId,
    actor: "client",
    locale,
  })
  await recordCommunication({
    clientId,
    bookingId,
    kind: "confirmation",
    trigger: "auto",
    recipient: to,
    status: statusFromEmailResult(res),
    error: res.error,
  })
}

/** Both create paths book a CATALOG service — the one-time-offer path is its own
    action (modules/design), because its authorization is a signed token. */
const draftInputFor = (input: {
  serviceId: string
  addonIds: string[]
  start: string
  notes?: string
  locale?: string
}) => ({
  ref: serviceRef(input.serviceId, input.addonIds),
  start: input.start,
  notes: input.notes,
  locale: input.locale,
})

/** Why the box didn't pass, in words a client can act on. */
function humanCheckMessage(reason: string): string {
  if (reason === "missing") return "Please tick the “I'm not a robot” box first."
  if (reason === "expired" || reason === "reused") {
    return "That check has expired — tick the box again and retry."
  }
  return "That check didn't pass — tick the box again and retry."
}

const overlapMessage = (reason: "overlap" | "error") =>
  reason === "overlap"
    ? "That time was just taken — please pick another."
    : "Couldn't create the booking."

/**
 * Create an in-house booking. Public, and guarded in layers — the two the
 * artist controls from App settings come first:
 *
 *   1. **Human check** — a solved proof-of-work, if she has it on.
 *   2. **Access level** — from `verified` up, the email comes FROM the session.
 *      At `open` it comes off the form, which is how the calendar came to be
 *      writable by anyone who could POST.
 *   3. **Blocklist** — her manual list of addresses, domains and IPs.
 *
 * Then the ones she doesn't control: the honeypot, a durable per-client rate
 * limit, a cap of 2 active bookings, a server-side slot re-check, and the
 * exclusion constraint on the overlap race. Records service-terms acceptance
 * (best-effort). The `card` level is feature G
 * (docs/tasks/in-house/CARD-HOLD.md).
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  // Honeypot — a hidden field only a bot fills. Reject generically (don't reveal
  // the trap), same message as a create failure.
  if (input.honeypot?.trim()) return { ok: false, error: "Couldn't create the booking." }

  const db = createSupabaseServiceRoleClient()

  // The artist's dial (App settings → Booking protection). Both fall back to
  // the safe side if the settings row can't be read.
  const protection = await getBookingProtectionSettings(db)

  // Her switch AND a signing secret: with no secret the box isn't rendered, so
  // demanding a proof would refuse every booking.
  const humanCheckOn = protection.humanCheck && humanCheckConfigured()
  // Verified early (it is cheap, and rubbish should cost nothing) but SPENT
  // late, with the other write guards — see below.
  if (humanCheckOn) {
    const human = await verifyHumanProof(input.humanProof)
    if (!human.ok) {
      return { ok: false, code: "human", error: humanCheckMessage(human.reason) }
    }
  }

  // `code: "auth"` ONLY for a missing session — it sends the UI to sign-in, so
  // a signed-in account that simply has no usable address must report a plain
  // error instead of bouncing to /login and back forever.
  const user = await getCurrentUser()
  if (requiresVerifiedIdentity(protection.accessLevel) && !user) {
    return {
      ok: false,
      code: "auth",
      error: "Please sign in to book — it takes a moment and confirms your email.",
    }
  }

  // Signed in → the session's address, which is what makes it verified. At the
  // `open` level, fall back to the form's — and there the honeypot, the human
  // check and the blocklist are what carry the weight.
  const email = (user?.email ?? input.email ?? "").trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      error: user
        ? "Your account has no email address we can confirm to — please contact the studio."
        : "Enter a valid email.",
    }
  }

  // The manual blocklist — address, email domain or IP. Generic refusal: a
  // blocked person learning WHICH of the three matched just rotates that one.
  const ip = await callerIp()
  const blocked = await checkBlocked(db, { email, ip })
  if (blocked.blocked) {
    return { ok: false, error: "We can't take this booking online — please contact the studio." }
  }

  const prepared = await buildBookingDraft(db, draftInputFor(input), {
    checkSlot: true,
  })
  if (!prepared.ok) return prepared
  const { draft } = prepared

  let clientId: string
  try {
    // Resolves to this client's own row; name fills if empty and phone
    // refreshes to the number they booked with.
    clientId = await ensureUser({
      email,
      name: input.name.trim() || undefined,
      // Store a clean E.164 number; fall back to the trimmed input if it can't
      // be normalised (it already passed the phone-pattern gate).
      phone: input.phone ? (toE164(input.phone) ?? input.phone.trim()) : undefined,
    })
  } catch {
    return { ok: false, error: "Couldn't save your details — please try again." }
  }

  // Cap active bookings per client (hands + feet). Beyond that, point them at the
  // studio — the request-to-artist overflow is a later feature. Fail open on a
  // count hiccup: a read error must never block an otherwise-valid booking.
  try {
    const active = await countActiveUpcomingBookingsForClient(
      db,
      clientId,
      new Date().toISOString(),
    )
    if (active >= MAX_ACTIVE_BOOKINGS) {
      return {
        ok: false,
        code: "cap",
        error:
          "You already have 2 active bookings (the maximum). You can send a request for this time instead.",
      }
    }
  } catch {
    /* count failed — allow rather than block */
  }

  // Last thing before the write, so a taken slot or the cap above costs no
  // quota. Durable (Postgres): the in-process limiter is per instance.
  //
  // Keyed on the CONNECTION as well as the client when there is no session:
  // without one, `clientId` comes from whatever email was typed, so rotating
  // addresses hands out a fresh bucket every time. The IP is the only stable
  // thing left at the `open` level.
  const buckets = [`booking:create:${clientId}`]
  if (!user && ip) buckets.push(`booking:create:ip:${ip}`)
  for (const bucket of buckets) {
    if (!(await takeDurableToken(db, bucket, CREATE_RULE))) {
      return {
        ok: false,
        error: "That's a lot of bookings in a short time — please contact the studio.",
      }
    }
  }

  // Claim the proof's single use here, not at verification: a taken slot or the
  // cap above would otherwise burn it, and the client's next attempt would fail
  // a check they had just passed.
  if (humanCheckOn) {
    const spent = await spendHumanProof(db, input.humanProof)
    if (!spent.ok) {
      return { ok: false, code: "human", error: humanCheckMessage(spent.reason) }
    }
  }

  const locale = resolveLocale(input.locale)
  // Remember the site locale so this client's future emails match — best-effort;
  // a pre-migration missing column must never fail the booking.
  try {
    await updateClientCommunicationLocale(db, clientId, locale)
  } catch {
    /* booking proceeds regardless */
  }

  const result = await insertBooking(db, { client_id: clientId, ...draft.values })
  if (!result.ok) return { ok: false, error: overlapMessage(result.reason) }

  await recordTermsAcceptance(db, {
    clientId,
    kind: "service",
    context: "booking",
    referenceId: result.id,
  })

  await sendConfirmation(
    draft,
    result.id,
    clientId,
    email,
    input.name.trim().split(/\s+/)[0] || null,
    input.start,
    locale,
  )

  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true, id: result.id }
}

export type OwnerCreateBookingInput = {
  // Book for an existing client by id, OR a new one by contact (email required).
  clientId?: string
  email?: string
  name?: string
  phone?: string
  serviceId: string
  addonIds: string[]
  start: string
  notes?: string
  locale?: string
  /** "Ignore all limits" — skip the slot/hours/day check so the artist can place
      an appointment on any day at any time (overlap constraint still applies). */
  ignoreLimits?: boolean
}

/**
 * Owner books on a client's behalf (admin "New booking" / rebook). Owner-only,
 * and not bound by the public 24 h lead time — the studio can place near-term
 * slots. Books for an existing client by id, or create-or-finds one from the
 * given contact. The client still gets the confirmation email + manage link.
 */
export async function createBookingAsOwner(
  input: OwnerCreateBookingInput,
): Promise<CreateBookingResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const prepared = await buildBookingDraft(db, draftInputFor(input), {
    checkSlot: !input.ignoreLimits,
    ignoreLeadTime: true,
  })
  if (!prepared.ok) return prepared
  const { draft } = prepared

  // Resolve the client + who to email: an existing client, else a new one. An
  // existing client's saved locale wins; a new one gets the locale it booked in.
  const bookedLocale = resolveLocale(input.locale)
  let clientId: string
  let recipientEmail: string | null
  let firstName: string | null
  let emailLocale: Locale
  if (input.clientId) {
    clientId = input.clientId
    const contact = (await fetchClientContacts([clientId]))[clientId]
    recipientEmail = contact?.email ?? null
    firstName = contact?.firstName ?? null
    emailLocale = contact?.communicationLocale ?? bookedLocale
  } else {
    const email = input.email?.trim().toLowerCase() ?? ""
    if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter a valid client email." }
    try {
      clientId = await ensureUser({
        email,
        name: input.name?.trim() || undefined,
        phone: input.phone ? (toE164(input.phone) ?? input.phone.trim()) : undefined,
      })
    } catch {
      return { ok: false, error: "Couldn't save the client — please try again." }
    }
    recipientEmail = email
    firstName = input.name?.trim().split(/\s+/)[0] || null
    emailLocale = bookedLocale
  }

  const result = await insertBooking(db, { client_id: clientId, ...draft.values })
  if (!result.ok) return { ok: false, error: overlapMessage(result.reason) }

  // No service-terms record: the client didn't accept terms in an owner-placed
  // booking (unlike the public flow).
  // Confirmation to the client — skipped cleanly if there's no email on file.
  if (recipientEmail) {
    await sendConfirmation(
      draft,
      result.id,
      clientId,
      recipientEmail,
      firstName,
      input.start,
      emailLocale,
    )
  }

  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.appointments)
  revalidatePath(revalidatePatterns.adminClient, "page")
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true, id: result.id }
}

/**
 * The outside-hours calendar for the public booking flow, on demand.
 *
 * Public like the rest of the booking read — it lists free times, not anyone's
 * data — and reached from the client step the moment the visitor opens "Can't
 * find a time?", so the page itself never carries it.
 */
export async function getOutsideSlotsForBooking(
  ref: SubjectRef,
): Promise<Slot[]> {
  return getOutsideSlots(ref)
}

/**
 * Owner-gated available slots for the admin "New booking" flow — the same
 * availability as the public picker but without the 24 h lead time, so the
 * studio can place near-term appointments. Returns [] when not the owner.
 */
export async function getOwnerSlots(ref: SubjectRef): Promise<Slot[]> {
  const db = await requireOwner()
  if (!db) return []
  return getAvailableSlots(ref, undefined, { ignoreLeadTime: true })
}

/**
 * Owner-gated OVERRIDE slots — free times on any day within the override envelope
 * with hours/no-work/lead ignored, but existing bookings still excluded. Backs
 * the admin "Ignore all limits" picker. Returns [] when not the owner.
 */
export async function getOwnerOverrideSlots(ref: SubjectRef): Promise<Slot[]> {
  const db = await requireOwner()
  if (!db) return []
  return getOverrideSlots(ref, db)
}
