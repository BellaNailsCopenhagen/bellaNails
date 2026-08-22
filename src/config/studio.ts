/**
 * Studio identity constants — the address is a literal (never translated) and
 * renders on the home FindUs section, the footer, and the booking
 * confirmation. One constant so a move can't leave a stale copy behind on a
 * page nobody QAs casually (the confirmation is only seen post-booking).
 */
export const STUDIO_ADDRESS_LINE_1 = "Halldór Laxness Vej 3, 2. th"
export const STUDIO_ADDRESS_LINE_2 = "2300 København S"
export const STUDIO_ADDRESS = `${STUDIO_ADDRESS_LINE_1} · ${STUDIO_ADDRESS_LINE_2}`

/** Studio display name — wordmark in emails, and anywhere the brand is named. */
export const STUDIO_NAME = "Bella Nails"

/** Public contact (decided July 2026: email-first, no messaging system). */
export const STUDIO_EMAIL = "hello@bellanails.dk"

/** Times are stored UTC; every client-facing time renders in studio time. */
export const STUDIO_TIME_ZONE = "Europe/Copenhagen"

export const STUDIO_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Halldór Laxness Vej 3, 2300 København S")
