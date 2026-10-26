import { ImageResponse } from "next/og"

import { BRAND } from "@/config/brand"

/**
 * The app-icon monogram, rendered once for every surface that needs it: the
 * PWA manifest icons (`/icons/*.png`) and the iOS apple-touch icon. One source
 * so the mark can't drift between them.
 *
 * Placeholder art — an onyx tile with a "B". ImageResponse uses its built-in
 * sans face (no brand font is loaded here); refine to the real Cormorant
 * monogram when we ship a rasterizable brand mark.
 */
export function renderAppIcon(
  size: number,
  { maskable = false }: { maskable?: boolean } = {},
): ImageResponse {
  // Maskable icons must keep the mark inside the safe zone, so shrink the
  // letter and drop the rounded corners (the OS applies its own mask).
  const letterSize = Math.round(size * (maskable ? 0.44 : 0.58))
  const radius = maskable ? 0 : Math.round(size * 0.22)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND.cta,
        color: BRAND.background,
        borderRadius: radius,
      }}
    >
      <div
        style={{
          fontSize: letterSize,
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        B
      </div>
    </div>,
    { width: size, height: size },
  )
}
