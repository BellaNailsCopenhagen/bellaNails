import { PriceTag } from "@/components/ui/price-tag"
import { BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { InsightsDisclaimer } from "@/app/admin/insights/_components/insights-disclaimer"
import { RecalculateButton } from "@/app/admin/insights/_components/recalculate-button"
import type { InsightsMonth } from "@/modules/studio/insights"
import { formatStudioMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"
import { cn } from "@/shared/cn"

/** Minutes as the artist would say them — "6 h 30", not 390. */
function asHours(mins: number): string {
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest}` : `${hours} h`
}

/**
 * A month per row, newest first, with the current one led out as the headline.
 *
 * Occupancy is shown beside the hours it came from rather than alone: 40% means
 * nothing until you know it was 40% of a three-day week, and the artist is the
 * only one who can judge whether that is a full diary or a quiet one.
 */
export function InsightsBoard({
  months,
  bufferMins,
  snapshotsUnavailable,
}: {
  months: InsightsMonth[]
  bufferMins: number
  snapshotsUnavailable: boolean
}) {
  const withActivity = months.filter(
    (month) => month.appointments > 0 || (month.openMins ?? 0) > 0,
  )
  const current = months.find((month) => month.inProgress)

  return (
    <div className="space-y-8">
      <InsightsDisclaimer />

      {current ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <Headline
            label={`${formatStudioMonthYear(current.atMs, ADMIN_LOCALE)} so far`}
            value={<PriceTag cents={current.incomeCents} />}
            note={
              current.appointments === 1
                ? "1 appointment"
                : `${current.appointments} appointments`
            }
          />
          <Headline
            label="Of your open hours, booked"
            value={
              current.occupancy === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${current.occupancy}%`
              )
            }
            note={
              current.openMins
                ? `${asHours(current.bookedMins)} of ${asHours(current.openMins)} open so far`
                : "No opening hours set for this month"
            }
          />
        </section>
      ) : null}

      {withActivity.length ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
              Month by month
            </p>
            <RecalculateButton />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Month", "Done", "Brought in", "Booked", "Of open hours"].map(
                    (heading, index) => (
                      <th
                        key={heading}
                        className={cn(
                          "pb-2 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground",
                          index > 0 && "text-right",
                        )}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {withActivity.map((month) => (
                  <tr key={month.key} className="border-b border-border last:border-b-0">
                    <td className="py-3 font-functional text-sm text-foreground">
                      {formatStudioMonthYear(month.atMs, ADMIN_LOCALE)}
                      {month.inProgress ? (
                        <span className="ml-2 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                          so far
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right font-functional text-sm text-muted-foreground">
                      {month.appointments}
                      {month.adjusted ? (
                        <span
                          title={`${month.adjusted} with an amount you set yourself`}
                          className="ml-1 text-[0.625rem] uppercase tracking-widest-lux text-warning"
                        >
                          adj
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right font-functional text-sm text-foreground">
                      <PriceTag cents={month.incomeCents} />
                    </td>
                    <td className="py-3 text-right font-functional text-sm text-muted-foreground">
                      {asHours(month.bookedMins)}
                      {month.openMins ? (
                        <span className="block text-[0.625rem] text-muted-foreground/70">
                          of {asHours(month.openMins)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right font-functional text-sm text-muted-foreground">
                      {month.occupancy === null ? "—" : `${month.occupancy}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          title="Nothing to show yet"
          body="Once appointments have happened, what they brought in and how much of your week they filled will appear here."
        />
      )}

      <div className="max-w-prose space-y-2">
        <BodySm className="text-xs text-muted-foreground">
          &ldquo;Booked&rdquo; counts each appointment&rsquo;s length plus the{" "}
          {bufferMins} minutes your calendar keeps free after it — that time is
          spoken for, so it counts as used. A missed appointment counts as booked
          time but earns nothing, unless you record what you charged for it.
        </BodySm>
        <BodySm className="text-xs text-muted-foreground">
          A month keeps the opening hours it actually had, so changing your week
          now leaves last winter as it was rather than re-dividing it by the week
          you keep today. A month showing no percentage is one nobody was
          watching — it ended before this was kept — and it stays that way rather
          than being given a figure worked out from the wrong week. This month is
          measured against the days and hours that have actually passed.
        </BodySm>
        {snapshotsUnavailable ? (
          <BodySm className="text-xs text-warning">
            Months aren&rsquo;t being kept yet — every figure here was worked out
            just now. Apply <code>supabase/insights-months.sql</code> and they
            will settle.
          </BodySm>
        ) : null}
      </div>
    </div>
  )
}

function Headline({
  label,
  value,
  note,
}: {
  label: string
  value: React.ReactNode
  note: string
}) {
  return (
    <div className="space-y-1 rounded-md border border-border p-5">
      <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
        {label}
      </p>
      <p className="font-editorial text-3xl text-foreground">{value}</p>
      <p className="font-functional text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
