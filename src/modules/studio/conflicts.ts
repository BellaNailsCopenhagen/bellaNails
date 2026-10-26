import "server-only"

import { listActiveBookingsFrom } from "@/db/bookings"
import type { Db } from "@/db/client"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { getSchedule } from "@/modules/studio/hours"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import { standardDay, type Schedule } from "@/shared/schedule"
import type { TimeRange } from "@/shared/studio-hours"
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

/** The schedule that decides whether a booking is bookable — captured BEFORE a
    mutation so conflicts can be diffed against the AFTER state. */
export type ScheduleSnapshot = { schedule: Schedule }

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

const fits = (
  ranges: TimeRange[],
  startMs: number,
  endMs: number,
  day: number,
) => containedIn(startMs, endMs, toInstants(day, ranges))

/**
 * The current schedule. Call BEFORE a mutation to capture the "before", then
 * pass it to getScheduleConflicts after saving.
 *
 * `db` is required. It used to default to a service-role client, which every
 * real caller overrode with a `requireOwner()` one — so the default was gated
 * in practice and a bypass waiting for the first caller who forgot.
 */
export async function getScheduleSnapshot(db: Db): Promise<ScheduleSnapshot> {
  return { schedule: await getSchedule(db) }
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
  /** Required, for the same reason as `getScheduleSnapshot`'s. */
  db: Db,
): Promise<ScheduleConflict[]> {
  const [after, bookings] = await Promise.all([
    getScheduleSnapshot(db),
    listActiveBookingsFrom(db, new Date().toISOString()).catch(() => []),
  ])
  if (!bookings.length) {
    return []
  }

  const flagged: {
    bookingId: string
    clientId: string
    start: string
    end: string
    reason: ScheduleConflict["reason"]
  }[] = []

  // Bookings cluster on a handful of days — resolve each day's standard ranges once.
  const afterCache = new Map<number, ReturnType<typeof standardDay>>()
  const beforeCache = new Map<number, ReturnType<typeof standardDay>>()
  const dayStd = (
    cache: Map<number, ReturnType<typeof standardDay>>,
    schedule: Schedule,
    day: number,
  ) => {
    let v = cache.get(day)
    if (!v) {
      v = standardDay(schedule, day)
      cache.set(day, v)
    }

    return v
  }

  for (const booking of bookings) {
    const startMs = new Date(booking.start_time).getTime()
    const endMs = new Date(booking.end_time).getTime()
    const day = studioDayNumber(startMs)

    // Still fits → fine. Didn't fit before either → not stranded by THIS change
    // (it was already an intentional out-of-hours booking). Only the ones this
    // edit newly pushed out of bounds are conflicts.
    const afterStd = dayStd(afterCache, after.schedule, day)
    if (fits(afterStd.effective, startMs, endMs, day)) {
      continue
    }
    if (
      !fits(
        dayStd(beforeCache, before.schedule, day).effective,
        startMs,
        endMs,
        day,
      )
    ) {
      continue
    }

    // Classify why it no longer fits, against the AFTER standard hours: closed
    // (no standard that day) / no_work (in raw standard but carved) / outside.
    const reason: ScheduleConflict["reason"] =
      afterStd.raw.length === 0
        ? "closed"
        : fits(afterStd.raw, startMs, endMs, day)
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
  if (!flagged.length) {
    return []
  }

  const contacts = await fetchClientContacts(
    flagged.map((f) => f.clientId),
  ).catch((): Record<string, ClientContact> => ({}))

  return flagged.map((f) => ({
    bookingId: f.bookingId,
    start: f.start,
    end: f.end,
    clientName: contactDisplayName(contacts[f.clientId]),
    reason: f.reason,
  }))
}
