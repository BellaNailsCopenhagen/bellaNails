"use server"

import { revalidatePath } from "next/cache"

import { listActiveBookingsStartingBetween } from "@/db/bookings"
import { listSentReminders } from "@/db/communications"
import { fetchClientContacts } from "@/modules/clients"
import { requireOwner } from "@/modules/identity/require-owner"
import { sendBookingReminderEmail } from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { localizedBookingNames, metaOf } from "@/shared/booking-policy"
import { routes } from "@/shared/routes"
import { dayNumberToMs, studioDayNumber } from "@/shared/studio-time"

type SendRemindersResult =
  { ok: true; note: string } | { ok: false; error: string }

/**
 * The admin "Send reminders" button — email every client with a booking on the
 * NEXT studio-day. Owner-gated. Idempotent per booking: a booking that already
 * got a successful reminder is skipped, so re-clicking only catches newly-added
 * ones (that IS "one successful action a day"). A failed/skipped send is retried
 * next click. Every send is logged to `communications`.
 */
export async function sendReminders(): Promise<SendRemindersResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "Not authorized." }
  }

  // `dayNumberToMs` is NOON-UTC (DST-safe), NOT a day boundary — so query a
  // generous UTC superset (today→+3 days) and filter to tomorrow's studio-day
  // precisely with `studioDayNumber`. Never invert to UTC midnights; that breaks
  // on the two DST transitions.
  const today = studioDayNumber(Date.now())
  const tomorrow = today + 1
  const windowStart = new Date(dayNumberToMs(today)).toISOString()
  const windowEnd = new Date(dayNumberToMs(today + 3)).toISOString()

  let candidates
  try {
    candidates = await listActiveBookingsStartingBetween(
      db,
      windowStart,
      windowEnd,
    )
  } catch {
    return { ok: false, error: "Couldn't load tomorrow's bookings." }
  }
  const bookings = candidates.filter(
    (b) => studioDayNumber(new Date(b.start_time).getTime()) === tomorrow,
  )
  if (bookings.length === 0) {
    return { ok: true, note: "No bookings tomorrow — nothing to send." }
  }

  // Fail CLOSED on the idempotency read — if we can't tell what already went out,
  // abort rather than risk a duplicate blast. (The owner just retries.)
  let sentReminders: { bookingId: string; reminderFor: string | null }[]
  let contacts: Awaited<ReturnType<typeof fetchClientContacts>>
  try {
    ;[sentReminders, contacts] = await Promise.all([
      listSentReminders(
        db,
        bookings.map((b) => b.id),
      ),
      fetchClientContacts(bookings.map((b) => b.client_id)),
    ])
  } catch {
    return {
      ok: false,
      error: "Couldn't check which reminders already went out.",
    }
  }
  // Key on (booking, its appointment time) so a booking rescheduled INTO tomorrow
  // (its old reminder was for a different time) still gets a fresh reminder.
  const remindedKeys = new Set(
    sentReminders.map(
      (r) =>
        `${r.bookingId}|${r.reminderFor ? new Date(r.reminderFor).getTime() : 0}`,
    ),
  )

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const b of bookings) {
    if (remindedKeys.has(`${b.id}|${new Date(b.start_time).getTime()}`)) {
      skipped++
      continue
    }
    const contact = b.client_id ? contacts[b.client_id] : undefined
    if (!b.client_id || !contact?.email) {
      skipped++
      continue
    }

    const locale = contact.communicationLocale
    const { serviceName, addonNames } = localizedBookingNames(metaOf(b), locale)
    const res = await sendBookingReminderEmail({
      to: contact.email,
      firstName: contact.firstName,
      serviceName,
      addonNames,
      startIso: b.start_time,
      endIso: b.end_time,
      priceCents: b.total_price_cents,
      // No manage link on a reminder — it's usually <24 h out, past the policy
      // window, so the link would only bounce. Reschedule lives in My Space.
      bookingId: b.id,
      actor: "studio",
      locale,
    })
    await recordCommunication({
      clientId: b.client_id,
      bookingId: b.id,
      kind: "reminder",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
      reminderFor: b.start_time,
    })
    if (res.ok) {
      sent++
    } else if (res.skipped) {
      skipped++
    } else {
      failed++
    }
  }

  revalidatePath(routes.admin.home)
  const tail = [
    skipped ? `${skipped} skipped` : "",
    failed ? `${failed} failed` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const note =
    sent > 0
      ? `Sent ${sent} reminder${sent === 1 ? "" : "s"}${tail ? ` · ${tail}` : ""}.`
      : `No new reminders sent${tail ? ` · ${tail}` : ""}.`

  return { ok: true, note }
}
