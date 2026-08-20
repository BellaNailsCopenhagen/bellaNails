"use client"

import { useRouter } from "next/navigation"

import { CalEmbedShell } from "@/components/booking/cal-embed-shell"
import { settleBookingRow } from "@/shared/booking-probe"

/**
 * Owner reschedule-on-behalf — the same Cal reschedule embed the client flow
 * uses, in the admin (English, non-localized). On success (Cal issues a NEW
 * uid): settle our row (sync-first, capped), then back to the queue.
 */
export function AdminRescheduleEmbed({ uid }: { uid: string }) {
  const router = useRouter()

  const onSuccess = async (newUid: string | undefined) => {
    if (newUid) await settleBookingRow(newUid)
    router.replace("/admin")
    // Bust the client cache so the queue re-renders with the moved booking.
    router.refresh()
  }

  return (
    <CalEmbedShell
      calLink={`reschedule/${uid}`}
      successAction="rescheduleBookingSuccessfulV2"
      onSuccess={onSuccess}
      config={{ theme: "light" }}
      loadingLabel="Loading…"
      securingLabel="Securing the new time…"
    />
  )
}
