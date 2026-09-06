/**
 * Where a shared asset can be placed. One source of truth for the surface set,
 * their labels, and which the consent purpose allows — shared by the server
 * action (validation) and the admin manager (UI). Client-safe.
 */
export const ASSET_SURFACES = ["clients_gallery", "showcase", "some"] as const

export type AssetSurface = (typeof ASSET_SURFACES)[number]

export const SURFACE_LABELS: Record<AssetSurface, string> = {
  clients_gallery: "Gallery page",
  showcase: "Home page",
  some: "Social",
}

/** website release → website surfaces; social release → SoMe. Placement can't
    outrun what the client approved. (`education` never produces an on-site copy.) */
export function surfacesForPurpose(purpose: string): AssetSurface[] {
  return purpose === "social" ? ["some"] : ["clients_gallery", "showcase"]
}

export function isAssetSurface(value: string): value is AssetSurface {
  return (ASSET_SURFACES as readonly string[]).includes(value)
}

// Surfaces the public site actually renders (home showcase + /gallery). SoMe is
// a manual post elsewhere, so it never churns our own pages. A `testimonial`
// surface used to sit here too — nothing ever rendered it, and a testimonial is
// words the client wrote, not a picture.
const PUBLIC_SURFACES: readonly AssetSurface[] = ["clients_gallery", "showcase"]

export function isPublicSurface(value: string): boolean {
  return (PUBLIC_SURFACES as readonly string[]).includes(value)
}
