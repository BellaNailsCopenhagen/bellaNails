/**
 * Booking contact validation — shared by the details form (HTML constraint
 * attributes) and the /book routing gate (a hand-edited `step=confirm` URL
 * with missing/invalid contact data must fall back to the details step).
 * The HTML_* strings are the same rules in `pattern`-attribute form so the
 * two layers can never disagree. Deliberately lenient: catch typos, don't
 * police formats.
 */

/** Anything@anything.tld — catches missing @/domain, not exotic RFC cases. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const EMAIL_HTML_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}"

/** Optional +, then 8–15 digits with spaces/()/- allowed between them. */
export const PHONE_PATTERN = /^\+?(?:[ ()-]*\d){8,15}[ ()-]*$/
export const PHONE_HTML_PATTERN = "\\+?(?:[ ()-]*[0-9]){8,15}[ ()-]*"

/** The studio is Danish — a bare local number gets the +45 country code. */
const DEFAULT_COUNTRY_CODE = "45"

/**
 * Coerce a free-typed phone to E.164 (`+` then 8–15 digits); null if
 * implausible. Best-guess for a Danish studio — swap in libphonenumber-js for
 * full i18n. Used to normalise the booking contact phone number.
 */
export function toE164(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith("+")
  let digits = trimmed.replace(/\D/g, "")
  if (!digits) return null
  // "00" = international prefix (e.g. 0045…), same intent as a leading "+".
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2)
  // Exactly 8 digits = a Danish local number — even with a stray "+", since no
  // real international number is only 8 digits including its country code.
  else if (digits.length === 8) digits = `${DEFAULT_COUNTRY_CODE}${digits}`
  const candidate = `+${digits}`
  return /^\+\d{8,15}$/.test(candidate) ? candidate : null
}

/**
 * What the booking flow carries in its URL.
 *
 * `email` is present ONLY when the artist has turned "require a sign-in to
 * book" off — with the gate on, identity is the session's and the address never
 * touches a query string, browser history or our access logs. With it off we
 * have to ask, and that trade-off comes back with it.
 */
export type BookingContact = {
  name?: string
  email?: string
  phone?: string
  notes?: string
  /** Honeypot field ("company") — carried through the flow; a filled value is a bot. */
  honeypot?: string
}

/** Server-side caps — HTML `maxLength` is bypassable via a hand-edited URL. */
export const MAX_NAME_LENGTH = 100
export const MAX_NOTES_LENGTH = 500

const DEL = 0x7f
const TAB = 0x09
const LINE_FEED = 0x0a

/**
 * Strip control chars (log/terminal-injection vectors), trim, and cap length;
 * null if empty. `allowNewlines` keeps tab + line feed for the notes field.
 */
export function sanitizeContactText(
  value: string | undefined | null,
  maxLength: number,
  { allowNewlines = false }: { allowNewlines?: boolean } = {},
): string | null {
  if (!value) return null
  const kept: string[] = []
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    const isControl = code < 0x20 || code === DEL
    const keep = allowNewlines && (code === TAB || code === LINE_FEED)
    if (isControl && !keep) continue
    kept.push(ch)
  }
  const cleaned = kept.join("").trim()
  if (!cleaned) return null
  // Cap by code point (kept holds whole code points) so a surrogate pair at the
  // boundary isn't split into a lone surrogate.
  return [...cleaned].slice(0, maxLength).join("")
}

/**
 * The flow's URL state, for a link that has to come back to a step with the
 * selection intact — the sign-in round trip on the details step and the
 * lapsed-session one on the confirm step build the same thing.
 */
export function bookingFlowQuery(input: {
  serviceId: string
  addonIds: string[]
  step: "details" | "confirm"
  contact?: BookingContact
}): URLSearchParams {
  const query = new URLSearchParams({
    service: input.serviceId,
    step: input.step,
  })
  if (input.addonIds.length) query.set("addons", input.addonIds.join(","))
  const { name, email, phone, notes } = input.contact ?? {}
  if (name) query.set("name", name)
  if (email) query.set("email", email)
  if (phone) query.set("phone", phone)
  if (notes) query.set("notes", notes)
  return query
}

/**
 * True when the flow has everything the create call needs.
 *
 * A name, and an email only when sign-in is off — otherwise the session
 * supplies it.
 *
 * **Phone is optional.** There is no SMS or calling flow yet, so a number the
 * studio cannot use must not stand between a client and a booking. One that IS
 * given still has to look like a number, because a typo helps nobody: the
 * point is that blank is allowed, not that anything is.
 */
export function isCompleteContact(
  contact: BookingContact,
  { requireEmail = false }: { requireEmail?: boolean } = {},
): boolean {
  const phone = contact.phone?.trim()
  return (
    (contact.name?.trim().length ?? 0) >= 2 &&
    (!phone || PHONE_PATTERN.test(phone)) &&
    (!requireEmail || EMAIL_PATTERN.test(contact.email ?? ""))
  )
}
