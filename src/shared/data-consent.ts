/**
 * Data-use consent — the studio's request to use a client's NAME or their WORDS
 * (media from an appointment is a separate, booking-level release). Pure rule +
 * vocabulary, so the client centre, the actions, and the admin panel all agree.
 */

/** The display order. `client_consents` is read without an ORDER BY, so without
    projecting onto this the list reshuffled every time a row was updated. */
export const DATA_CONSENT_PURPOSES = [
  "name_site",
  "name_some",
  "testimonial_site",
  "testimonial_some",
] as const

export type DataConsentPurpose = (typeof DATA_CONSENT_PURPOSES)[number]

export function isDataConsentPurpose(
  value: string,
): value is DataConsentPurpose {
  return (DATA_CONSENT_PURPOSES as readonly string[]).includes(value)
}
