"use client"

import * as React from "react"
import Cal, { getCalApi } from "@calcom/embed-react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { TintedCard } from "@/components/ui/tinted-card"
import { Caption } from "@/components/ui/typography"
import { settleBookingRow } from "@/lib/booking-probe"
import { CALCOM_EMBED_JS_URL, CALCOM_ORIGIN } from "@/config/calcom"
import { routes } from "@/config/routes"

const EMBED_MIN_HEIGHT = "36rem"

/**
 * RescheduleEmbed — Cal's reschedule view for an existing booking, inline
 * and brand-themed so the client never leaves the site. On success (Cal
 * issues a NEW uid) it waits for our webhook row, then returns to /bookings.
 */
export function RescheduleEmbed({ uid }: { uid: string }) {
  const t = useTranslations("booking")
  const router = useRouter()
  const [ready, setReady] = React.useState(false)
  const [securing, setSecuring] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const onLinkReady = () => setReady(true)
    const onBooked = (event: { detail: { data: { uid?: string } } }) => {
      const newUid = event.detail.data.uid
      const goToBookings = () => {
        router.replace(routes.bookings)
        // Bust the client router cache — /bookings was likely just visited;
        // a plain replace would serve the stale payload.
        router.refresh()
      }
      if (!newUid) {
        goToBookings()
        return
      }
      setSecuring(true)
      // Not gated on cleanup: Cal has already rescheduled.
      void settleBookingRow(newUid).then(goToBookings)
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
          light: { "cal-brand": "#121212" },
          dark: { "cal-brand": "#fbfbfa" },
        },
      })
      cal("on", { action: "linkReady", callback: onLinkReady })
      // Reschedules fire their own success event — NOT bookingSuccessfulV2.
      cal("on", { action: "rescheduleBookingSuccessfulV2", callback: onBooked })
    })()

    return () => {
      cancelled = true
      // Window-level singleton — always detach or handlers stack per remount.
      calApi?.("off", { action: "linkReady", callback: onLinkReady })
      calApi?.("off", {
        action: "rescheduleBookingSuccessfulV2",
        callback: onBooked,
      })
    }
  }, [router])

  return (
    <div className="w-full">
      <div className="relative" style={{ minHeight: EMBED_MIN_HEIGHT }}>
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
          calLink={`reschedule/${uid}`}
          calOrigin={CALCOM_ORIGIN}
          embedJsUrl={CALCOM_EMBED_JS_URL}
          config={{ theme: "light" }}
          style={{ width: "100%", minHeight: EMBED_MIN_HEIGHT }}
        />
      </div>
    </div>
  )
}
