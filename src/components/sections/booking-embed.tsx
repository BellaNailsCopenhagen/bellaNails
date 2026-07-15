"use client"

import * as React from "react"
import Cal, { getCalApi } from "@calcom/embed-react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { waitForBookingRow } from "@/lib/booking-probe"
import { TintedCard } from "@/components/ui/tinted-card"
import { Caption } from "@/components/ui/typography"
import type { BookingContact } from "@/lib/contact-validation"
import { CALCOM_EMBED_JS_URL, CALCOM_ORIGIN } from "@/config/calcom"
import { routes } from "@/config/routes"

/** Skeleton and iframe share this height — unequal values reintroduce the
    layout shift the fixed shell exists to prevent. */
const EMBED_MIN_HEIGHT = "36rem"

/** IDs-only machine payload for the webhook (Task 02) — never parsed as text. */
type BookingMetadata = {
  serviceId: string
  addonIds: string[]
  totalPriceCents: number
  totalDurationMins: number
  locale: string
  /** The client's own session note — machine copy the webhook stores
      (Cal metadata values cap at 500 chars, same as the form's maxLength). */
  clientNotes?: string
}

/**
 * BookingEmbed — the inline Cal.com booker (EU instance), pre-configured with
 * the computed slot length, contact prefill from step 02, the localized notes
 * summary, and IDs-only metadata. Client component: the embed needs the
 * browser. On a successful booking it redirects to /confirmation with the
 * Cal booking uid.
 */
export function BookingEmbed({
  calLink,
  slotMins,
  prefill,
  notesSummary,
  metadata,
}: {
  calLink: string
  slotMins: number
  prefill: BookingContact
  notesSummary: string
  metadata: BookingMetadata
}) {
  const t = useTranslations("booking")
  const router = useRouter()
  // Skeleton shows until Cal reports the booker ready — leaving it mounted
  // behind the loaded iframe reads as a duplicated container.
  const [ready, setReady] = React.useState(false)
  // Cal has created the booking; we're waiting for our webhook-written row so
  // /confirmation opens with the recap already there. Slot conflicts never
  // reach this state — Cal rejects those inside the embed, before success.
  const [securing, setSecuring] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const onLinkReady = () => setReady(true)
    const onBooked = (event: { detail: { data: { uid?: string } } }) => {
      const { uid } = event.detail.data
      // `replace`, not `push`: drops the armed confirm step out of history so
      // browser-back can't resurface a completed booking for a double-book.
      // The email rides along to prefill the account block on /confirmation.
      const query = {
        ...(uid ? { uid } : {}),
        ...(prefill.email ? { email: prefill.email } : {}),
      }
      const goToConfirmation = () =>
        router.replace({ pathname: routes.confirmation, query })
      if (!uid) {
        goToConfirmation()
        return
      }
      setSecuring(true)
      // Deliberately not gated on effect cleanup: the booking exists in Cal,
      // so this navigation must survive re-renders, unmounts and back
      // presses — anything else strands the user on an armed flow.
      void waitForBookingRow(uid).then(goToConfirmation)
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
          // The embed is forced to light theme, but the type requires both.
          light: { "cal-brand": "#121212" },
          dark: { "cal-brand": "#fbfbfa" },
        },
      })
      cal("on", { action: "linkReady", callback: onLinkReady })
      cal("on", { action: "bookingSuccessfulV2", callback: onBooked })
    })()

    return () => {
      cancelled = true
      // getCalApi hands back a window-level singleton: without `off`, every
      // remount (locale switch, back/forward) stacks another handler and one
      // booking would push to /confirmation once per stacked listener.
      calApi?.("off", { action: "linkReady", callback: onLinkReady })
      calApi?.("off", { action: "bookingSuccessfulV2", callback: onBooked })
    }
  }, [router, prefill.email])

  // The visitor's own notes ride along under the composed summary so the
  // artist sees both; metadata keys use Cal's `metadata[key]` param form.
  const notes = [notesSummary, prefill.notes].filter(Boolean).join("\n\n")

  return (
    <div className="w-full">
      <div className="relative" style={{ minHeight: EMBED_MIN_HEIGHT }}>
        {/* Branded skeleton while the booker boots; removed on linkReady so
            it can't peek out around the loaded iframe. */}
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
        {/* Post-success hold: the booking exists in Cal; cover the booker
            while our row lands so /confirmation opens complete. */}
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
          config={{
            name: prefill.name ?? "",
            email: prefill.email ?? "",
            ...(prefill.phone ? { attendeePhoneNumber: prefill.phone } : {}),
            notes,
            duration: String(slotMins),
            // NOTE: Cal cloud has no per-visitor language override — the
            // booker auto-detects the browser language (calcom/cal.com#8904).
            // Revisit if Cal ships a ?language= param.
            theme: "light",
            "metadata[serviceId]": metadata.serviceId,
            "metadata[addonIds]": metadata.addonIds.join(","),
            "metadata[totalPriceCents]": String(metadata.totalPriceCents),
            "metadata[totalDurationMins]": String(metadata.totalDurationMins),
            "metadata[locale]": metadata.locale,
            ...(metadata.clientNotes
              ? { "metadata[clientNotes]": metadata.clientNotes.slice(0, 500) }
              : {}),
          }}
          style={{ width: "100%", minHeight: EMBED_MIN_HEIGHT }}
        />
      </div>
    </div>
  )
}

export type { BookingMetadata }
