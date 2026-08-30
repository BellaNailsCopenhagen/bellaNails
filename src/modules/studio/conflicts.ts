import "server-only"

import { listActiveBookingsFrom } from "@/db/bookings"
import type { Db } from "@/db/client"
import { getOutsideHoursConfig } from "@/db/studio-hours"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { getStudioHours } from "@/modules/studio/hours"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import {
  effectiveRangesForDayNumber,
  type StudioHours,
  type TimeRange,
  type WeeklyHours,
} from "@/shared/studio-hours"
import { studioDayNumber, studioWallTimeToInstant } from "@/shared/studio-time"

/**
 * A future booking a schedule change would strand — non-blocking, but the artist
 * should know. `reason` says why it no longer fits the bookable hours.
 */
export type ScheduleConflict = {
  bookingId: string
  start: string
  end: string
  clientName: string
  reason: "no_work" | "outside_hours" | "closed"
}

/** The schedule inputs that decide whether a booking is bookable — captured
    BEFORE a mutation so conflicts can be diffed against the AFTER state. */
export type ScheduleSnapshot = { hours: StudioHours; noWork?: WeeklyHours }

const toInstants = (day: number, ranges: TimeRange[]) =>
  ranges.map(
    (range) =>
      [
        studioWallTimeToInstant(day, range[0]),
        studioWallTimeToInstant(day, range[1]),
      ] as const,
  )

const containedIn = (
  startMs: number,
  endMs: number,
  ranges: readonly (readonly [number, number])[],
) => ranges.some(([open, close]) => startMs >= open && endMs <= close)

const fitsSchedule = (
  snapshot: ScheduleSnapshot,
  startMs: number,
  endMs: number,
  day: number,
) => {
  const bookable = effectiveRangesForDayNumber(snapshot.hours, day, {
    noWork: snapshot.noWork,
  })
  return containedIn(startMs, endMs, toInstants(day, bookable.ranges))
}

/** The current schedule (weekly + special + no-work). Call BEFORE a mutation to
    capture the "before", then pass it to getScheduleConflicts after saving. */
export async function getScheduleSnapshot(
  db: Db = createSupabaseServiceRoleClient(),
): Promise<ScheduleSnapshot> {
  const [hours, outsideConfig] = await Promise.all([
    getStudioHours(db),
    getOutsideHoursConfig(db).catch(() => null),
  ])
  return {
    hours,
    noWork: (outsideConfig?.noWork as WeeklyHours | null) ?? undefined,
  }
}

/**
 * Future active bookings THIS schedule change stranded: ones that fit the
 * `before` snapshot but no longer fit the current (after) schedule. The
 * before/after diff is the point — a booking that was already outside hours
 * (an accepted outside-hours request, an "ignore limits" override) fit neither,
 * so it's never flagged. Read-only; the artist decides what to do.
 */
export async function getScheduleConflicts(
  before: ScheduleSnapshot,
  db: Db = createSupabaseServiceRoleClient(),
): Promise<ScheduleConflict[]> {
  const [after, bookings] = await Promise.all([
    getScheduleSnapshot(db),
    listActiveBookingsFrom(db, new Date().toISOString()).catch(() => []),
  ])
  if (!bookings.length) return []

  const flagged: {
    bookingId: string
    clientId: string
    start: string
    end: string
    reason: ScheduleConflict["reason"]
  }[] = []

  for (const booking of bookings) {
    const startMs = new Date(booking.start_time).getTime()
    const endMs = new Date(booking.end_time).getTime()
    const day = studioDayNumber(startMs)

    // Still fits → fine. Didn't fit before either → not stranded by THIS change
    // (it was already an intentional out-of-hours booking). Only the ones this
    // edit newly pushed out of bounds are conflicts.
    if (fitsSchedule(after, startMs, endMs, day)) continue
    if (!fitsSchedule(before, startMs, endMs, day)) continue

    // Classify why it no longer fits, against the AFTER standard hours.
    const standard = effectiveRangesForDayNumber(after.hours, day, {})
    const reason: ScheduleConflict["reason"] = standard.closed
      ? "closed"
      : containedIn(startMs, endMs, toInstants(day, standard.ranges))
        ? "no_work"
        : "outside_hours"

    flagged.push({
      bookingId: booking.id,
      clientId: booking.client_id,
      start: booking.start_time,
      end: booking.end_time,
      reason,
    })
  }
  if (!flagged.length) return []

  const contacts = await fetchClientContacts(flagged.map((f) => f.clientId)).catch(
    (): Record<string, ClientContact> => ({}),
  )
  return flagged.map((f) => ({
    bookingId: f.bookingId,
    start: f.start,
    end: f.end,
    clientName: contactDisplayName(contacts[f.clientId]),
    reason: f.reason,
  }))
}
