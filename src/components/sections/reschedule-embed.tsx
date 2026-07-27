"use client"

import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { CalEmbedShell } from "@/components/sections/cal-embed-shell"
import { settleBookingRow } from "@/lib/booking-probe"
import { routes } from "@/config/routes"

/**
 * RescheduleEmbed — Cal's reschedule view for an existing booking, inline
 * and brand-themed. On success (Cal issues a NEW uid): settle our row
 * (sync-first, capped), then back to /bookings with a fresh render.
 */
export function RescheduleEmbed({ uid }: { uid: string }) {
  const t = useTranslations("booking")
  const router = useRouter()

  const onSuccess = async (newUid: string | undefined) => {
    if (newUid) await settleBookingRow(newUid)
    router.replace(routes.appointments)
    // Bust the client router cache — /bookings was likely just visited; a
    // plain replace would serve the stale payload.
    router.refresh()
  }

  return (
    <CalEmbedShell
      calLink={`reschedule/${uid}`}
      successAction="rescheduleBookingSuccessfulV2"
      onSuccess={onSuccess}
      config={{ theme: "light" }}
      loadingLabel={t("embedLoading")}
      securingLabel={t("securingBooking")}
    />
  )
}
