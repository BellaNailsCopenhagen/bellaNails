import { hasOpeningHours, weeklyOpeningDays } from "@/shared/opening-hours"
import type { Schedule } from "@/shared/schedule"
import { weekdayIndexForDayNumber } from "@/shared/studio-hours"
import {
  dayNumberToMs,
  formatStudioWeekdayShort,
  studioDayNumber,
} from "@/shared/studio-time"

/**
 * The week, a day per line, closed days included.
 *
 * Every day is listed because the week is not uniform — a late Thursday, a half
 * Saturday, a Monday off — and a list that omits the closed days leaves the
 * reader working out which ones are missing.
 *
 * Weekday NAMES are resolved here rather than in `shared/opening-hours.ts`, so
 * the rules stay pure and one locale can't quietly disagree with another about
 * which days are open.
 *
 * Rendered in the footer and on /hours. Deliberately NOT on the home page's
 * Find-us section: a studio that opens two days a week shows five rows of
 * "Closed" there, which reads as shut rather than as by-appointment.
 */
export function OpeningHours({
  schedule,
  locale,
  closedLabel,
  className,
}: {
  schedule: Schedule
  locale: string
  closedLabel: string
  className?: string
}) {
  // Nothing recurring on the books → say nothing. Seven "Closed" rows tell
  // nobody anything, and the "by appointment" note carries it instead.
  if (!hasOpeningHours(schedule)) return null

  const names = weekdayNames(locale)

  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 ${className ?? ""}`}>
      {weeklyOpeningDays(schedule).map((day) => {
        const closed = day.ranges.length === 0
        return (
          // The row is `display: contents`, which generates no box — so opacity
          // has to sit on the CELLS, not here. It dims rather than recolours
          // because this renders on a light section AND the dark footer, and a
          // hardcoded colour would be invisible on one of them.
          <div key={day.weekday} className="contents">
            <dt className={closed ? "opacity-55" : undefined}>
              {names[day.weekday]}
            </dt>
            <dd className={closed ? "opacity-55" : undefined}>
              {closed
                ? closedLabel
                : day.ranges
                    .map(([start, end]) => `${start} – ${end}`)
                    .join(", ")}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Localized short weekday names, index 0 = Monday. */
function weekdayNames(locale: string): string[] {
  // Any week works — only the weekday indices are read off it.
  const today = studioDayNumber(Date.now())
  const names: string[] = []
  for (let offset = 0; offset < 7; offset += 1) {
    const dayNumber = today + offset
    names[weekdayIndexForDayNumber(dayNumber)] = formatStudioWeekdayShort(
      dayNumberToMs(dayNumber),
      locale,
    )
  }
  return names
}
