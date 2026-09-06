/**
 * The business's own details, as every surface reads them. Client-safe: the
 * admin form and the footer both need this shape, and neither may reach a
 * module.
 */

export type BusinessProfile = {
  /** Public contact, and the reply-to on outbound mail. Always set (falls back
      to the compiled-in constant). */
  contactEmail: string
  /** Send-as alias for transactional booking mail. Always set. */
  bookingFromEmail: string
  /** Where the app writes TO the owner. Always set (contact address if unset). */
  alertEmail: string
  /** Street line, then post town. May be empty — no address is compiled in. */
  addressLine1: string
  addressLine2: string
  /** What sits behind the landing statement — the uploaded asset, else the
      photo shipped with the app. `kind` decides whether the hero renders an
      image or a film. */
  heroBackground: HeroBackground
  /** Resolved URL for the map picture — the uploaded one, else the generic
      illustration shipped with the app. Never null: the section always has
      something to show once there is an address. */
  mapImageUrl: string
  /** Null = no account, so the link is not rendered at all. A dead link to
      instagram.com is worse than no icon. */
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
}

/** What the artist can edit, before defaults are applied — an empty string
    means "clear this and go back to the default / hide the link". */
export type BusinessProfileInput = {
  contactEmail: string
  bookingFromEmail: string
  alertEmail: string
  addressLine1: string
  addressLine2: string
  instagramUrl: string
  facebookUrl: string
  tiktokUrl: string
}

/** The hero background, resolved. Never null — there is always the shipped
    photo to fall back to. */
export type HeroBackground = { url: string; kind: "image" | "video" }

/**
 * The photo shipped with the app: the hero before she has uploaded anything, and
 * the `poster` behind a film while it loads. A background that starts as a black
 * rectangle reads as a broken page for the second it lasts.
 */
export const DEFAULT_HERO_IMAGE = "/assets/hero_image.jpg"

export const DEFAULT_HERO_BACKGROUND: HeroBackground = {
  url: DEFAULT_HERO_IMAGE,
  kind: "image",
}

/** What to aim for, said in the admin. Full-bleed behind text, so it is cropped
    hard on a phone — the subject has to survive losing its sides. */
export const HERO_GUIDANCE = {
  width: 1900,
  height: 1200,
  seconds: 10,
} as const

/**
 * The fallback map picture: an abstract, address-free street pattern drawn by
 * us. A default that depicted a real place would be wrong for every business
 * but one, and a third-party map image would drag licensing in with it.
 */
export const DEFAULT_MAP_IMAGE = "/assets/map-placeholder.svg"

/** Recommended upload, matching how the section renders it (a 5:2 band at the
    container's full width) and what the uploader does to it. */
export const MAP_IMAGE_GUIDANCE = {
  width: 1200,
  height: 480,
  ratio: "5:2",
} as const

/** The address on one line — emails, calendar invites, anywhere without room
    for two. */
export const oneLineAddress = (profile: {
  addressLine1: string
  addressLine2: string
}): string =>
  [profile.addressLine1, profile.addressLine2].filter(Boolean).join(" · ")

/**
 * A map link for the address, derived rather than stored — a third field to
 * keep in step with the other two is a third field to get wrong.
 */
export function mapsUrlFor(profile: {
  addressLine1: string
  addressLine2: string
}): string | null {
  const query = [profile.addressLine1, profile.addressLine2]
    .filter(Boolean)
    .join(", ")
  // No address, no link — a search for "" lands the visitor nowhere useful.
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Where a bare handle turns into a profile URL. TikTok keeps the `@` — its
    profile paths are `/@name`, so stripping it produces a dead link. */
const SOCIAL: Record<
  "instagramUrl" | "facebookUrl" | "tiktokUrl",
  { host: string; handlePrefix: string }
> = {
  instagramUrl: { host: "instagram.com", handlePrefix: "" },
  facebookUrl: { host: "facebook.com", handlePrefix: "" },
  tiktokUrl: { host: "tiktok.com", handlePrefix: "@" },
}

/**
 * Coerce what she typed into a URL worth rendering, or null.
 *
 * Accepts all three things people actually paste: a full URL, a host-and-path
 * ("www.instagram.com/bellanails"), and a bare handle ("@bellanails").
 *
 * A slash is what separates the second case from the third — NOT a dot, because
 * plenty of real handles contain one ("bella.nails"), and treating those as
 * hosts produced a saved-but-dead link with no complaint.
 *
 * Anything that isn't http(s) is refused: a `javascript:` href in the footer
 * would be an XSS hole with a nice icon.
 */
export function normalizeSocialUrl(
  field: keyof typeof SOCIAL,
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim()
  if (!value) return null

  const { host, handlePrefix } = SOCIAL[field]
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  const candidate = hasScheme
    ? value
    : value.includes("/")
      ? `https://${value.replace(/^\/+/, "")}`
      : `https://${host}/${handlePrefix}${value.replace(/^@/, "")}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    // A path-less host is a handle that lost its way ("instagram.com").
    if (url.pathname === "/" && !url.search) return null
    return url.toString()
  } catch {
    return null
  }
}
