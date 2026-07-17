"use client"

import * as React from "react"
import Cal, { getCalApi } from "@calcom/embed-react"
import { useTranslations } from "next-intl"

import { TintedCard } from "@/components/ui/tinted-card"
import { Caption } from "@/components/ui/typography"
import { CALCOM_EMBED_JS_URL, CALCOM_ORIGIN } from "@/config/calcom"

/** Skeleton and iframe share this height — unequal values reintroduce the
    layout shift the fixed shell exists to prevent. */
const EMBED_MIN_HEIGHT = "36rem"

/** New bookings and reschedules fire DIFFERENT success events. */
type CalSuccessAction = "bookingSuccessfulV2" | "rescheduleBookingSuccessfulV2"

/**
 * CalEmbedShell — everything both Cal embeds share: brand theming, the boot
 * skeleton, singleton listener wiring, and the post-success "securing" hold.
 * When the success event fires, the shell covers the booker and runs
 * `onSuccess(uid)` — the caller settles the row and navigates.
 */
export function CalEmbedShell({
  calLink,
  config,
  successAction,
  onSuccess,
}: {
  calLink: string
  config: React.ComponentProps<typeof Cal>["config"]
  successAction: CalSuccessAction
  onSuccess: (uid: string | undefined) => void | Promise<void>
}) {
  const t = useTranslations("booking")
  const [ready, setReady] = React.useState(false)
  const [securing, setSecuring] = React.useState(false)
  // The latest onSuccess without re-running the boot effect per render.
  const onSuccessRef = React.useRef(onSuccess)
  React.useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  React.useEffect(() => {
    let cancelled = false
    const onLinkReady = () => setReady(true)
    const onBooked = (event: { detail: { data: { uid?: string } } }) => {
      setSecuring(true)
      // Not gated on cleanup: Cal has already acted — the flow must move
      // forward through re-renders and unmounts.
      void onSuccessRef.current(event.detail.data.uid)
    }

    let calApi: Awaited<ReturnType<typeof getCalApi>> | undefined
    ;(async () => {
      const cal = await getCalApi({ embedJsUrl: CALCOM_EMBED_JS_URL })
      if (cancelled) return
      calApi = cal
      cal("ui", {
        theme: "light",
        hideEventTypeDetails: false,
        cssVarsPerTheme: {
          // Forced to light theme, but the type requires both.
          light: { "cal-brand": "#121212" },
          dark: { "cal-brand": "#fbfbfa" },
        },
      })
      cal("on", { action: "linkReady", callback: onLinkReady })
      cal("on", { action: successAction, callback: onBooked })
    })()

    return () => {
      cancelled = true
      // Window-level singleton — always detach or handlers stack per remount
      // and one booking would navigate once per stacked listener.
      calApi?.("off", { action: "linkReady", callback: onLinkReady })
      calApi?.("off", { action: successAction, callback: onBooked })
    }
  }, [successAction])

  return (
    <div className="w-full">
      <div className="relative" style={{ minHeight: EMBED_MIN_HEIGHT }}>
        {/* Boot skeleton; removed on linkReady so it can't peek out around
            the loaded iframe. */}
        {ready ? null : (
          <TintedCard
            aria-hidden
            className="absolute inset-0 -z-10 flex items-center justify-center"
          >
            <Caption className="tracking-widest-lux">
              {t("embedLoading")}
            </Caption>
          </TintedCard>
        )}
        {/* Post-success hold while the row settles (capped by the caller). */}
        {securing ? (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-border bg-background/90 backdrop-blur-[2px]"
          >
            <Caption className="tracking-widest-lux">
              {t("securingBooking")}
            </Caption>
          </div>
        ) : null}
        <Cal
          calLink={calLink}
          calOrigin={CALCOM_ORIGIN}
          embedJsUrl={CALCOM_EMBED_JS_URL}
          config={config}
          style={{ width: "100%", minHeight: EMBED_MIN_HEIGHT }}
        />
      </div>
    </div>
  )
}
