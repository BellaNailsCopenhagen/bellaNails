import type { MetadataRoute } from "next"

import { BRAND } from "@/config/brand"

/**
 * Web App Manifest for the installable admin PWA. Served as a route handler
 * (not the root `app/manifest.ts` magic file) and linked ONLY from the admin
 * layout's metadata, so the client site never advertises the studio app.
 *
 * Scoped to /admin: installing yields a standalone app that launches straight
 * into the owner queue; the client site keeps opening in the browser. Icons
 * are generated PNGs (app/icons/[name]/route.tsx) — no build-time image tooling.
 * The dotted path keeps it out of the i18n proxy matcher, so it stays public
 * (metadata only — nothing sensitive).
 */
export const dynamic = "force-static"

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/admin",
    name: "Bella Nails Studio",
    short_name: "Bella Studio",
    description: "Studio admin for Bella Nails — bookings, clients, services.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.background,
    theme_color: BRAND.background,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  })
}
