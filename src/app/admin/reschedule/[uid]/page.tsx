import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { H2 } from "@/components/ui/typography"
import { AdminRescheduleEmbed } from "@/components/admin/admin-reschedule-embed"
import { isActiveBookingStatus } from "@/lib/booking-status"
import { CAL_UID_PATTERN } from "@/lib/booking-sync"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Reschedule" }

export const dynamic = "force-dynamic"

/**
 * Owner reschedule-on-behalf. The proxy gates /admin to the owner; the row is
 * read via service-role (owner may move any booking — no RLS-own check, no
 * 24 h policy). Only active bookings are reschedulable. On success the embed
 * settles our row and returns to the queue.
 */
export default async function AdminReschedulePage({
  params,
}: {
  params: Promise<{ uid: string }>
}) {
  const { uid } = await params
  if (!CAL_UID_PATTERN.test(uid)) notFound()

  const service = createSupabaseServiceRoleClient()
  const { data: booking } = await service
    .from("bookings")
    .select("cal_uid, status")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (!booking || !isActiveBookingStatus(booking.status)) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>Reschedule</H2>
      </div>
      <AdminRescheduleEmbed uid={uid} />
    </div>
  )
}
