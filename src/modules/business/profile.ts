import "server-only"

import { cache } from "react"

import { getBusinessProfileRow, isMissingTable } from "@/db/business-profile"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import { objectUrl } from "@/platform/storage/supabase"
import { kindForKey } from "@/shared/media-policy"
import {
  DEFAULT_MAP_IMAGE,
  type BusinessProfile,
  type BusinessProfileInput,
  DEFAULT_HERO_BACKGROUND,
  type HeroBackground,
} from "@/shared/business-profile"
import {
  DEFAULT_ADDRESS_LINE_1,
  DEFAULT_ALERT_EMAIL,
  DEFAULT_ADDRESS_LINE_2,
  DEFAULT_BOOKING_FROM_EMAIL,
  DEFAULT_CONTACT_EMAIL,
} from "@/config/studio"

/**
 * The business's own details, with the env-var defaults as the floor.
 *
 * Every field is optional in the database on purpose: an empty one means "use
 * the default" for the addresses and "don't render the link" for the socials.
 * So a missing table, a missing row and a failed read all behave identically.
 *
 * Every field can also end up EMPTY, because no real address or mailbox is
 * compiled in — callers must render nothing rather than assume a value.
 *
 * Memoized per request: the footer, Find us and the email senders all ask.
 */
/** A stored key to something the hero can render. An unset key, or one that
    won't resolve because storage isn't configured, falls back to the shipped
    photo — the hero is the whole first screen and must never be empty. */
function resolveHero(key: string | null | undefined): HeroBackground {
  const trimmed = key?.trim()
  if (!trimmed) return DEFAULT_HERO_BACKGROUND
  const url = objectUrl(trimmed)
  return url ? { url, kind: kindForKey(trimmed) } : DEFAULT_HERO_BACKGROUND
}

export const getBusinessProfile = cache(async (): Promise<BusinessProfile> => {
  const fallback: BusinessProfile = {
    contactEmail: DEFAULT_CONTACT_EMAIL,
    bookingFromEmail: DEFAULT_BOOKING_FROM_EMAIL,
    alertEmail: DEFAULT_ALERT_EMAIL,
    addressLine1: DEFAULT_ADDRESS_LINE_1,
    addressLine2: DEFAULT_ADDRESS_LINE_2,
    heroBackground: DEFAULT_HERO_BACKGROUND,
    mapImageUrl: DEFAULT_MAP_IMAGE,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
  }

  try {
    const row = await getBusinessProfileRow(createSupabaseServerClient())
    if (!row) return fallback
    return {
      contactEmail: row.contact_email?.trim() || fallback.contactEmail,
      bookingFromEmail: row.booking_from_email?.trim() || fallback.bookingFromEmail,
      // Blank = wherever the contact address points, which is where these
      // alerts went before this field existed.
      alertEmail:
        row.alert_email?.trim() ||
        row.contact_email?.trim() ||
        fallback.alertEmail,
      addressLine1: row.address_line_1?.trim() || fallback.addressLine1,
      addressLine2: row.address_line_2?.trim() || fallback.addressLine2,
      heroBackground: resolveHero(row.hero_asset_key),
      // A key that won't resolve (storage unconfigured) degrades to the
      // shipped illustration rather than a broken image.
      mapImageUrl:
        (row.map_image_key?.trim()
          ? objectUrl(row.map_image_key.trim())
          : null) ?? DEFAULT_MAP_IMAGE,
      instagramUrl: row.instagram_url?.trim() || null,
      facebookUrl: row.facebook_url?.trim() || null,
      tiktokUrl: row.tiktok_url?.trim() || null,
    }
  } catch (error) {
    reportReadFailure(error)
    return fallback
  }
})

// A not-yet-applied migration is an EXPECTED state, not a fault: it would
// otherwise log on every render of every page, which trains you to ignore it.
// Said once, with the fix; anything else is a real fault and says so each time.
let warnedMissing = false

function reportReadFailure(error: unknown): void {
  if (isMissingTable(error)) {
    if (!warnedMissing) {
      warnedMissing = true
      console.warn(
        "[business] no business_profile table — using the env defaults. Apply supabase/business-profile.sql, then fill in Admin → More → Business.",
      )
    }
    return
  }
  console.error(
    "[business] profile read failed, using defaults:",
    error instanceof Error ? error.message : error,
  )
}

/**
 * Everything the admin form needs, from ONE read: the raw stored values, and
 * the map picture actually in use.
 *
 * The raw values matter because `getBusinessProfile()` resolves the defaults,
 * and a form prefilled with those would write today's constants into the row on
 * the first save — quietly ending the "blank means use the default" contract.
 * The defaults belong in the field's placeholder instead.
 */
export async function getBusinessProfileForAdmin(): Promise<{
  values: BusinessProfileInput
  mapImageUrl: string
  heroBackground: HeroBackground
}> {
  const blank: BusinessProfileInput = {
    contactEmail: "",
    bookingFromEmail: "",
    alertEmail: "",
    addressLine1: "",
    addressLine2: "",
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
  }
  try {
    const row = await getBusinessProfileRow(createSupabaseServerClient())
    if (!row) {
      return {
        values: blank,
        mapImageUrl: DEFAULT_MAP_IMAGE,
        heroBackground: DEFAULT_HERO_BACKGROUND,
      }
    }
    return {
      values: {
        contactEmail: row.contact_email ?? "",
        bookingFromEmail: row.booking_from_email ?? "",
        alertEmail: row.alert_email ?? "",
        addressLine1: row.address_line_1 ?? "",
        addressLine2: row.address_line_2 ?? "",
        instagramUrl: row.instagram_url ?? "",
        facebookUrl: row.facebook_url ?? "",
        tiktokUrl: row.tiktok_url ?? "",
      },
      mapImageUrl:
        (row.map_image_key?.trim() ? objectUrl(row.map_image_key.trim()) : null) ??
        DEFAULT_MAP_IMAGE,
      heroBackground: resolveHero(row.hero_asset_key),
    }
  } catch (error) {
    // The page still renders; she just sees blanks and can fill them in.
    reportReadFailure(error)
    return {
      values: blank,
      mapImageUrl: DEFAULT_MAP_IMAGE,
      heroBackground: DEFAULT_HERO_BACKGROUND,
    }
  }
}
