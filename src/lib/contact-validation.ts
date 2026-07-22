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
 * full i18n. Used both to attach phones to Clerk and to normalise Cal's.
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

export type BookingContact = {
  name?: string
  email?: string
  phone?: string
  notes?: string
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

/** True when name, email and phone are all present and well-formed. */
export function isCompleteContact(contact: BookingContact): boolean {
  return (
    (contact.name?.trim().length ?? 0) >= 2 &&
    EMAIL_PATTERN.test(contact.email ?? "") &&
    PHONE_PATTERN.test(contact.phone ?? "")
  )
}
