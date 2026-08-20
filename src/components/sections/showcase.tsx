import { getTranslations } from "next-intl/server"

import { ClientWorkSection } from "@/components/sections/client-work-section"
import { getPublicAssetsBySurface } from "@/modules/media/public-assets"

const SHOWCASE_LIMIT = 8

/**
 * Showcase — recent client work the artist has placed on the `showcase`
 * surface, on the home page. Renders nothing until the first photo is placed,
 * so the page degrades cleanly before any client has shared.
 */
export async function Showcase() {
  const [t, assets] = await Promise.all([
    getTranslations("showcase"),
    getPublicAssetsBySurface("showcase", SHOWCASE_LIMIT),
  ])

  if (!assets.length) return null

  return (
    <ClientWorkSection
      eyebrow={t("eyebrow")}
      lead={t("headingLead")}
      accent={t("headingAccent")}
      alt={t("alt")}
      assets={assets}
    />
  )
}
