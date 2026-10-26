import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ErrorState } from "@/components/ui/error-state"
import { InsightsBoard } from "@/app/admin/insights/_components/insights-board"
import { getStudioInsights } from "@/modules/studio/insights"

export const metadata: Metadata = {
  title: "Insights",
  robots: { index: false },
}
export const dynamic = "force-dynamic"

/**
 * Insights — what came in, and how much of the open week it took.
 *
 * Owner-only (gated by the proxy) and deliberately small: two numbers a month,
 * from the studio's own bookings and the artist's own corrections. It is not
 * accounting, and the screen says so before it says anything else.
 */
export default async function AdminInsightsPage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const { months, bufferMins, snapshotsUnavailable, loadError } =
    await getStudioInsights(now)

  return (
    <div className="space-y-6">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Insights</H2>
        <BodySm className="text-xs">
          What your appointments brought in, and how full the week was.
        </BodySm>
      </div>

      {loadError ? (
        <ErrorState
          title="Couldn’t load your numbers"
          body="Something went wrong reading the appointments. Try again in a moment — nothing has changed."
        />
      ) : (
        <InsightsBoard
          months={months}
          bufferMins={bufferMins}
          snapshotsUnavailable={snapshotsUnavailable}
        />
      )}
    </div>
  )
}
