/**
 * Pure month-grid helpers for the admin Calendar view. Works in the same
 * studio-local day-number space as `studioDayNumber` (both key off
 * `Date.UTC(year, month-1, day)`), so day-counts derived from bookings line up
 * with grid cells. Monday-start, DST-safe (integer arithmetic only).
 */

/** Shift a (year, 1-based month) by `delta` months, rolling the year over. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

/** Studio day-number of the 1st of (year, 1-based month). One definition,
    reused by the grid and by callers that need the month's anchor instant. */
export function monthStartDayNumber(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1) / 86_400_000
}

/**
 * Month laid out as a Monday-start grid of studio day-numbers, padded with
 * `null` (leading/trailing blanks) to whole weeks — ready to render 7 per row.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDayNumber = monthStartDayNumber(year, month)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const leading = (firstDayNumber + 3) % 7 // Monday-based weekday of the 1st

  const cells: (number | null)[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 0; d < daysInMonth; d++) cells.push(firstDayNumber + d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
