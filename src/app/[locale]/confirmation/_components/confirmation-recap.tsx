"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"

import type { BookingRecap } from "@/app/api/bookings/[uid]/route"
import { AppointmentSummary } from "@/components/booking/appointment-summary"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Caption, Eyebrow } from "@/components/ui/typography"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

/** The confirm step already waits for the webhook row before navigating
    here, so the first fetch normally succeeds instantly. The retry tail is
    a safety net for that wait's ~15 s timeout path and direct/old-link
    visits, where the row may land seconds later. */
const RETRY_DELAYS_MS = [1500, 4000, 8000, 15000]

/** 404 = webhook lag (retry until the row lands); anything else non-OK is a
    server hiccup worth the same retries. */
async function fetchRecap(uid: string, locale: string): Promise<BookingRecap> {
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(uid)}?locale=${locale}`,
  )
  if (!res.ok) throw new Error(`recap not ready (${res.status})`)
  return (await res.json()) as BookingRecap
}

/**
 * ConfirmationRecap — fetches the booking row and renders date/time + the
 * shared AppointmentSummary. Retry/backoff and staleness are useQuery's
 * job; the states degrade calmly: retries exhausted → "details are in your
 * email", cancelled booking (revisited old link) → explicit notice — never
 * a broken card.
 */
export function ConfirmationRecap({ uid }: { uid: string }) {
  const t = useTranslations("confirmation")
  const locale = useLocale()

  const { data: recap, isError } = useQuery({
    queryKey: ["booking-recap", uid, locale],
    queryFn: () => fetchRecap(uid, locale),
    retry: RETRY_DELAYS_MS.length,
    retryDelay: (attemptIndex) =>
      RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1],
    // "always": offline must fail into the email fallback, not sit paused
    // on the loading card forever (default networkMode never errors offline).
    networkMode: "always",
    // Refetch on every mount: a cached "confirmed" recap must not mask a
    // just-cancelled booking on back-navigation.
    staleTime: 0,
  })

  if (isError) {
    return (
      <TintedCard className="lg:max-w-[22.5rem]">
        <BodySm>{t("recapFallback")}</BodySm>
      </TintedCard>
    )
  }

  if (!recap) {
    return (
      <TintedCard
        aria-busy
        className="flex items-center justify-center py-16 lg:max-w-[22.5rem]"
      >
        <Caption className="tracking-widest-lux">{t("recapLoading")}</Caption>
      </TintedCard>
    )
  }

  // A revisited link for a booking that was cancelled (or replaced by a
  // reschedule — Cal issues the new time a fresh uid) must not present the
  // old slot as reserved.
  if (recap.status === BOOKING_STATUS.cancelled) {
    return (
      <TintedCard className="lg:max-w-[22.5rem]">
        <BodySm>{t("recapCancelled")}</BodySm>
      </TintedCard>
    )
  }

  return (
    <div className="w-full space-y-6 lg:max-w-[22.5rem]">
      <TintedCard>
        <div className="space-y-2">
          <Eyebrow className="font-normal">{t("whenLabel")}</Eyebrow>
          <BodySm className="font-editorial text-xl text-foreground">
            {formatStudioDate(recap.startTime, locale)}
          </BodySm>
          <Caption className="block tracking-wide normal-case">
            {t("timeAt")} {formatStudioTime(recap.startTime, locale)}
          </Caption>
        </div>
      </TintedCard>

      {recap.selection ? (
        <AppointmentSummary
          service={recap.selection.service}
          selectedAddons={recap.selection.addons}
          showTimeNote={false}
          // This page stacks until lg (the /book steps split at md).
          className="md:max-w-none lg:max-w-[22.5rem]"
        />
      ) : (
        <TintedCard>
          <BodySm>{t("recapFallback")}</BodySm>
        </TintedCard>
      )}
    </div>
  )
}
