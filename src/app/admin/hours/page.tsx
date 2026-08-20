import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { StudioHoursEditor } from "@/app/admin/hours/_components/studio-hours-editor"
import { getStudioHours } from "@/modules/studio/hours"

export const metadata: Metadata = { title: "Hours" }
export const dynamic = "force-dynamic"

/**
 * Studio working hours — the weekly schedule + special days. The source of truth
 * for opening times (public "hours") and, ahead, the in-house scheduler's
 * availability + occupancy. Owner-gated by the proxy.
 */
export default async function AdminHoursPage() {
  const hours = await getStudioHours()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/more"
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Working hours</H2>
        <BodySm className="text-xs">
          When the studio is open. Used for the public opening hours today, and
          the in-house booking availability + occupancy as they land.
        </BodySm>
      </div>

      <StudioHoursEditor initial={hours} />
    </div>
  )
}
