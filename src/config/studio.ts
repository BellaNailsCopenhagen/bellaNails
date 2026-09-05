/**
 * Studio identity — the parts that are still CODE, and where the rest lives.
 *
 * No real address or mailbox is compiled in. Those are the business's own data:
 * they live in `business_profile` (Admin → More → Business), with an
 * env var as the pre-migration fallback. Hardcoding one deployment's details
 * makes them another tenant's defaults the day this serves a second business.
 *
 * Read the live values with `getBusinessProfile()`.
 */

/**
 * Fallbacks for before the `business_profile` row is filled in. Empty is a
 * valid answer — a surface with no address renders no address, which is
 * correct, rather than someone else's.
 */
export const DEFAULT_ADDRESS_LINE_1 = process.env.BUSINESS_ADDRESS_LINE_1 ?? ""
export const DEFAULT_ADDRESS_LINE_2 = process.env.BUSINESS_ADDRESS_LINE_2 ?? ""

/**
 * Public contact, and the reply-to on every outbound email.
 *
 * Empty when unset — deliberately NOT the SMTP account. This value is rendered
 * as visible text on every public page, and the SMTP login may be a private
 * mailbox; falling back to it would publish half a credential pair site-wide
 * with nothing warning anyone.
 */
export const DEFAULT_CONTACT_EMAIL = process.env.BUSINESS_CONTACT_EMAIL ?? ""

/**
 * Last-resort ENVELOPE sender — the account SMTP authenticates as, so it is by
 * definition an address we may send from. Used only when nothing else is set,
 * and never displayed.
 */
export const SMTP_ACCOUNT_EMAIL = process.env.ZOHO_SMTP_USER ?? ""

/** Where the app writes TO the owner; the contact address if unset. */
export const DEFAULT_ALERT_EMAIL =
  process.env.BUSINESS_ALERT_EMAIL ?? DEFAULT_CONTACT_EMAIL

/** Send-as alias for transactional booking mail; the contact address if unset. */
export const DEFAULT_BOOKING_FROM_EMAIL =
  process.env.BUSINESS_BOOKING_FROM_EMAIL ?? DEFAULT_CONTACT_EMAIL

/** Display name — wordmark in emails, and anywhere the brand is named. Still a
    constant because the brand is also a checked-in SVG asset; making it data
    means making that an upload too. */
export const STUDIO_NAME = "Bella Nails"

/** Times are stored UTC; every client-facing time renders in this zone. A
    deployment fact, not a preference — hence not in the profile. */
export const STUDIO_TIME_ZONE = "Europe/Copenhagen"
