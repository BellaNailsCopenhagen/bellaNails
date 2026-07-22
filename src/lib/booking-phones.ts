import "server-only"

import { calBookingPhone } from "@/lib/cal-phone"
import { toE164 } from "@/lib/contact-validation"
import { CALCOM_API_BASE } from "@/config/calcom"

/**
 * Phones live in Cal, not our DB (Clerk's free plan can't store them). This
 * reads them at display time so the admin card can show/tap-to-call, without
 * persisting PII. See docs/tasks/explorations/auth-ownership-and-gdpr.md.
 */

/** Cal v2 GET /bookings — only the fields we read. */
type CalListBooking = {
  uid?: string
  attendees?: { phoneNumber?: string }[]
  bookingFieldsResponses?: { attendeePhoneNumber?: unknown }
}

/** Pad the window so boundary bookings aren't excluded by after/before. */
const WINDOW_PAD_MS = 60 * 60 * 1000
/** Cal's max page size. */
const PAGE_LIMIT = 100
/** Backstop against an unbounded cursor loop. */
const MAX_PAGES = 20
/** Phones rarely change — a short cache spares repeat renders/realtime a round
    trip. Window keys the URL, so a new edge booking naturally busts it. */
const CACHE_TTL_SECONDS = 120

/**
 * Resolve `cal_uid → E.164 phone` for the given bookings, in one paginated pass
 * over their time window. Stops as soon as every requested uid is found, so a
 * page cap can't silently drop a phone we display. Degrades to an empty map on
 * any failure — a Cal hiccup must never blank the admin list.
 */
export async function fetchCalPhones(
  windowStartMs: number,
  windowEndMs: number,
  neededUids: Set<string>,
): Promise<Record<string, string>> {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) {
    console.error("[booking-phones] CALCOM_API_KEY not configured")
    return {}
  }
  if (neededUids.size === 0) return {}

  const phones: Record<string, string> = {}
  const afterStart = new Date(windowStartMs - WINDOW_PAD_MS).toISOString()
  const beforeEnd = new Date(windowEndMs + WINDOW_PAD_MS).toISOString()

  try {
    let cursor: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${CALCOM_API_BASE}/bookings`)
      url.searchParams.set("afterStart", afterStart)
      url.searchParams.set("beforeEnd", beforeEnd)
      url.searchParams.set("limit", String(PAGE_LIMIT))
      if (cursor) url.searchParams.set("cursor", cursor)

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": "2026-05-01",
        },
        next: { revalidate: CACHE_TTL_SECONDS },
      })
      if (!res.ok) {
        console.error("[booking-phones] Cal API rejected", res.status)
        break
      }

      const body = (await res.json().catch(() => null)) as {
        data?: CalListBooking[]
        pagination?: { nextCursor?: string | null; hasMore?: boolean }
      } | null

      for (const booking of body?.data ?? []) {
        if (!booking.uid || !neededUids.has(booking.uid)) continue
        const e164 = toE164(calBookingPhone(booking))
        if (e164) phones[booking.uid] = e164
      }

      // Every requested phone found — no reason to keep paging.
      if (Object.keys(phones).length >= neededUids.size) break
      if (!body?.pagination?.hasMore || !body.pagination.nextCursor) break
      cursor = body.pagination.nextCursor
      if (page === MAX_PAGES - 1) {
        const unresolved = neededUids.size - Object.keys(phones).length
        console.error(`[booking-phones] hit MAX_PAGES, ${unresolved} phones unresolved`)
      }
    }
  } catch (error) {
    console.error(
      "[booking-phones] fetch failed",
      error instanceof Error ? error.message : error,
    )
  }
  return phones
}
