import type { BusinessProfile } from "@/shared/business-profile"
import { weeklyOpeningDays } from "@/shared/opening-hours"
import type { Schedule } from "@/shared/schedule"
import { WEEKDAYS } from "@/shared/studio-hours"

/**
 * `NailSalon` structured data — the single biggest on-page lever for a local
 * search, and the thing the whole `docs/seo-plan.md` acquisition plan needs
 * before any of the rest of it can work.
 *
 * Built from `business_profile` and `schedule_rules`, the same two sources the
 * footer and the /hours table read, and the opening hours specifically go
 * through `weeklyOpeningDays` — the exact function that renders the visible
 * table. Hand-written hours in markup are the classic way for a salon to tell
 * Google one thing and its visitors another; going through the same function
 * makes drifting impossible rather than unlikely.
 *
 * What is NOT here is as deliberate: no telephone and no geo coordinates.
 * Both are still open items in the SEO plan, and a made-up phone number in
 * structured data is worse than a missing one — Google shows it.
 */

/** schema.org wants English day names whatever language the page is in. */
const SCHEMA_DAY = WEEKDAYS.map((d) => d.label)

/** Split "2300 København" into the two fields schema.org asks for. A Danish
    post town is "<4 digits> <name>"; anything else is passed through whole. */
function splitPostTown(line: string): {
  postalCode?: string
  addressLocality?: string
} {
  const match = line.trim().match(/^(\d{4})\s+(.+)$/)
  if (!match) return line.trim() ? { addressLocality: line.trim() } : {}
  return { postalCode: match[1], addressLocality: match[2] }
}

export type LocalBusinessSchema = Record<string, unknown>

export function localBusinessSchema(input: {
  name: string
  url: string
  profile: Pick<
    BusinessProfile,
    | "addressLine1"
    | "addressLine2"
    | "contactEmail"
    | "instagramUrl"
    | "facebookUrl"
    | "tiktokUrl"
  >
  schedule: Schedule
  /** The neighbourhoods the plan targets, in the studio's own words. */
  areaServed: string[]
  /** Customer-facing phone number for schema.org LocalBusiness. Omitted if not set. */
  telephone?: string
  /** Geo coordinates [lat, lng] for schema.org LocalBusiness. Omitted if not set. */
  geo?: [number, number]
}): LocalBusinessSchema {
  const { profile, telephone, geo } = input

  const openingHoursSpecification = weeklyOpeningDays(input.schedule).flatMap(
    (day) =>
      day.ranges.map(([opens, closes]) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${SCHEMA_DAY[day.weekday]}`,
        opens,
        closes,
      })),
  )

  const sameAs = [
    profile.instagramUrl,
    profile.facebookUrl,
    profile.tiktokUrl,
  ].filter((url): url is string => Boolean(url))

  const schema: LocalBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    name: input.name,
    url: input.url,
    priceRange: "$$",
  }

  // Every field below is omitted rather than emitted empty: a PostalAddress
  // with no street, or `sameAs: []`, is a claim about the business that isn't
  // true yet.
  if (profile.addressLine1 || profile.addressLine2) {
    schema.address = {
      "@type": "PostalAddress",
      ...(profile.addressLine1
        ? { streetAddress: profile.addressLine1.trim() }
        : {}),
      ...splitPostTown(profile.addressLine2),
      addressCountry: "DK",
    }
  }
  if (profile.contactEmail) schema.email = profile.contactEmail
  if (input.areaServed.length) schema.areaServed = input.areaServed

  // Optional fields -- only emit when explicitly set, to avoid claiming
  // things that aren't set yet (e.g. a made-up phone number in structured
  // data is worse than a missing one -- Google shows it).
  if (telephone) schema.telephone = telephone
  if (geo) schema.geo = { "@type": "GeoCoordinates", latitude: geo[0], longitude: geo[1] }
  if (sameAs.length) schema.sameAs = sameAs
  if (openingHoursSpecification.length) {
    schema.openingHoursSpecification = openingHoursSpecification
  }

  return schema
}
