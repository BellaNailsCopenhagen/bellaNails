/**
 * Booking contact validation — shared by the details form (HTML constraint
 * attributes) and the /book routing gate (a hand-edited `step=confirm` URL
 * with missing/invalid contact data must fall back to the details step).
 * Deliberately lenient formats: the goal is catching typos, not policing.
 */

/** Anything@anything.tld — catches missing @/domain, not exotic RFC cases. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Optional +, then 8–20 digits allowing spaces/()/- between them. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{8,20}$/;

/** HTML `pattern` attribute form of PHONE_PATTERN (no anchors/flags). */
export const PHONE_HTML_PATTERN = "\\+?[0-9 ()-]{8,20}";

export type BookingContact = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

/** True when name, email and phone are all present and well-formed. */
export function isCompleteContact(contact: BookingContact): boolean {
  return (
    (contact.name?.trim().length ?? 0) >= 2 &&
    EMAIL_PATTERN.test(contact.email ?? "") &&
    PHONE_PATTERN.test(contact.phone ?? "")
  );
}
