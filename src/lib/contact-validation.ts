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

export type BookingContact = {
  name?: string
  email?: string
  phone?: string
  notes?: string
}

/** True when name, email and phone are all present and well-formed. */
export function isCompleteContact(contact: BookingContact): boolean {
  return (
    (contact.name?.trim().length ?? 0) >= 2 &&
    EMAIL_PATTERN.test(contact.email ?? "") &&
    PHONE_PATTERN.test(contact.phone ?? "")
  )
}
