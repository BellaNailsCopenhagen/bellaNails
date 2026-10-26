import { ImageResponse } from "next/og"

import { BRAND } from "@/config/brand"

/**
 * Branded Open Graph card — what a shared bellanails.dk link shows in
 * social/messaging apps. Generated (no stored asset). Satori has no CSS
 * pipeline, so colors come from the JS-side BRAND mirror, not CSS vars.
 */

export const alt = "Bella Nails — nail salon in Ørestad, Copenhagen"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const COPY = {
  da: {
    kicker: "NEGLESALON I ØRESTAD · KØBENHAVN",
    tagline: "Hvor håndværk bliver kunst",
  },
  en: {
    kicker: "NAIL SALON IN ØRESTAD · COPENHAGEN",
    tagline: "Where craft becomes art",
  },
} as const

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const copy = COPY[locale === "da" ? "da" : "en"]

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND.background,
        color: BRAND.textPrimary,
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: "0.35em",
          color: BRAND.textSecondary,
          marginBottom: 36,
        }}
      >
        {copy.kicker}
      </div>
      <div style={{ fontSize: 96, letterSpacing: "0.18em", fontWeight: 600 }}>
        BELLA NAILS
      </div>
      <div
        style={{
          width: 64,
          height: 2,
          backgroundColor: BRAND.divider,
          marginTop: 44,
          marginBottom: 40,
        }}
      />
      <div style={{ fontSize: 30, color: BRAND.textSecondary }}>
        {copy.tagline}
      </div>
    </div>,
    size,
  )
}
