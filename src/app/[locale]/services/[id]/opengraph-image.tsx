import { ImageResponse } from "next/og"

import { BRAND } from "@/config/brand"
import { getPublicService } from "@/modules/catalog"
import { pickLocalized } from "@/shared/localized"
import { formatPrice } from "@/shared/money"

/**
 * Share card for one service.
 *
 * A service page is the link people actually paste into a chat — "look at this
 * one" — and until now Next served them the locale-wide card, so every service
 * shared as "Where craft becomes art" with no clue which service it was.
 *
 * Same furniture as the site-wide card (same wordmark, rule and palette), with
 * the service in the place the tagline occupies there. Falls through to the
 * generic card by returning it unchanged when the id resolves to nothing, so a
 * dead link never renders a card with a hole in it.
 */

export const alt = "Bella Nails — service"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const COPY = {
  da: { kicker: "NEGLESALON I ØRESTAD · KØBENHAVN", mins: "min" },
  en: { kicker: "NAIL SALON IN ØRESTAD · COPENHAGEN", mins: "min" },
} as const

export default async function ServiceOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const isDa = locale === "da"
  const copy = COPY[isDa ? "da" : "en"]
  const service = await getPublicService(id).catch(() => null)
  const name = service
    ? (pickLocalized(locale, service.nameEn, service.nameDk) ?? service.nameEn)
    : null

  return new ImageResponse(
    (
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
          padding: "0 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: "0.35em",
            color: BRAND.textSecondary,
            marginBottom: 28,
          }}
        >
          {copy.kicker}
        </div>
        <div style={{ fontSize: 40, letterSpacing: "0.18em", fontWeight: 600 }}>
          BELLA NAILS
        </div>
        <div
          style={{
            width: 64,
            height: 2,
            backgroundColor: BRAND.divider,
            marginTop: 36,
            marginBottom: 36,
          }}
        />
        {/* The service leads at display size — it is what was shared. */}
        <div style={{ fontSize: name && name.length > 26 ? 60 : 76, lineHeight: 1.1 }}>
          {name ?? (isDa ? "Behandlinger" : "Services")}
        </div>
        {service ? (
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 36,
              fontSize: 30,
              color: BRAND.textSecondary,
            }}
          >
            <span>{formatPrice(service.basePriceCents, locale)}</span>
            <span>·</span>
            <span>
              {service.baseDurationMins} {copy.mins}
            </span>
          </div>
        ) : null}
      </div>
    ),
    size,
  )
}
