import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ScheduleEditor } from "@/app/admin/hours/_components/schedule-editor"
import { getSchedule } from "@/modules/studio"
import { routes } from "@/shared/routes"

export const metadata: Metadata = { title: "Hours" }
export const dynamic = "force-dynamic"

/**
 * Studio schedule — one calendar of standard / outside / no-work times (recurring
 * or one-off). The source of truth for the public opening hours and the in-house
 * booking availability. Owner-gated by the proxy.
 */
export default async function AdminHoursPage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock for the calendar's "today"
  const now = Date.now()
  const schedule = await getSchedule()

  return (
    <div className="space-y-6">
      <Link
        href={routes.admin.more}
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Working hours</H2>
        <BodySm className="text-xs">
          Standard hours clients can book, outside-hours they can request, and
          no-work blocks — recurring weekly or on a single date.
        </BodySm>
      </div>

      <ScheduleEditor schedule={schedule} now={now} />
    </div>
  )
}
