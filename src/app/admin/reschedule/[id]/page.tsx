import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { H2 } from "@/components/ui/typography"
import { AdminRescheduleSlotStep } from "@/app/admin/reschedule/[id]/_components/admin-reschedule-slot-step"
import { isActiveBookingStatus } from "@/shared/booking-status"
import { bookedDurationMins } from "@/shared/booking-policy"
import { routes } from "@/shared/routes"
import {
  getSlotsForDuration,
  getBookingForManageAsOwner,
  getMaxAdvanceDays,
} from "@/modules/booking"

export const metadata: Metadata = { title: "Reschedule" }

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Owner reschedule-on-behalf. The proxy gates /admin to the owner; the row is
 * read via service-role (owner may move any booking — no RLS-own check, no
 * 24 h policy). Only active bookings are reschedulable; availability is computed
 * in-house from the booking's own service + add-ons.
 */
export default async function AdminReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID.test(id)) {
    notFound()
  }

  const booking = await getBookingForManageAsOwner(id)
  if (!booking || !isActiveBookingStatus(booking.status)) {
    notFound()
  }

  // Owner picker mirrors rescheduleBookingAsOwner: no public 24 h lead time.
  const [slots, maxAdvanceDays] = await Promise.all([
    getSlotsForDuration(bookedDurationMins(booking), undefined, {
      ignoreLeadTime: true,
    }),
    getMaxAdvanceDays(),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={routes.admin.home}
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>Reschedule</H2>
      </div>
      <AdminRescheduleSlotStep
        id={id}
        slots={slots}
        maxAdvanceDays={maxAdvanceDays}
      />
    </div>
  )
}
