/**
 * Where a shared asset can be placed. One source of truth for the surface set,
 * their labels, and which the consent purpose allows — shared by the server
 * action (validation) and the admin manager (UI). Client-safe.
 */
export const ASSET_SURFACES = [
  "clients_gallery",
  "showcase",
  "testimonial",
  "some",
] as const

export type AssetSurface = (typeof ASSET_SURFACES)[number]

export const SURFACE_LABELS: Record<AssetSurface, string> = {
  clients_gallery: "Clients gallery",
  showcase: "Showcase",
  testimonial: "Testimonial",
  some: "Social",
}

/** Site consent → website surfaces; SoMe consent → social. Placement can't
    outrun what the client approved. */
export function surfacesForPurpose(purpose: string): AssetSurface[] {
  return purpose === "some"
    ? ["some"]
    : ["clients_gallery", "showcase", "testimonial"]
}

export function isAssetSurface(value: string): value is AssetSurface {
  return (ASSET_SURFACES as readonly string[]).includes(value)
}

// Surfaces the public site actually renders (home showcase + /gallery). SoMe is
// manual social; testimonial has no public render yet. Placing on anything else
// shouldn't churn the public pages.
const PUBLIC_SURFACES: readonly AssetSurface[] = ["clients_gallery", "showcase"]

export function isPublicSurface(value: string): boolean {
  return (PUBLIC_SURFACES as readonly string[]).includes(value)
}
