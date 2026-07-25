import "server-only"

import { CALCOM_API_BASE } from "@/config/calcom"

/**
 * Cal.com API v2 event-type management (create / patch / hide) used by the
 * catalog server actions to keep Cal in sync with our services. Distinct from
 * the booking reads in booking-sync.ts. Every call degrades to a typed error
 * (never throws) so an action can surface a sync failure without corrupting the
 * DB write it just made.
 *
 * NOTE: the exact v2 event-type request/response shape needs live verification
 * against Cal (this is the brief's flagged API risk) — the calls below follow
 * the documented v2 conventions; adjust field names if Cal rejects them.
 */

const CAL_API_VERSION = "2024-06-14"

export type CalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function calRequest<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<CalResult<T>> {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) return { ok: false, error: "CALCOM_API_KEY not configured" }

  try {
    const res = await fetch(`${CALCOM_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": CAL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as {
      data?: T
      error?: { message?: string }
    } | null
    if (!res.ok) {
      return {
        ok: false,
        error: `Cal ${res.status}: ${json?.error?.message ?? "request failed"}`,
      }
    }
    return { ok: true, data: (json?.data ?? null) as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cal unreachable",
    }
  }
}

/** Create an event type for a new service; returns its id + slug to store. */
export async function createCalEventType(input: {
  title: string
  slug: string
  lengthInMinutes: number
  lengthInMinutesOptions?: number[]
}): Promise<CalResult<{ id: number; slug: string }>> {
  const result = await calRequest<{ id?: number; slug?: string }>(
    "/event-types",
    "POST",
    {
      title: input.title,
      slug: input.slug,
      lengthInMinutes: input.lengthInMinutes,
      ...(input.lengthInMinutesOptions?.length
        ? { lengthInMinutesOptions: input.lengthInMinutesOptions }
        : {}),
    },
  )
  if (!result.ok) return result
  const { id, slug } = result.data ?? {}
  if (typeof id !== "number" || typeof slug !== "string") {
    return { ok: false, error: "Cal create: unexpected response shape" }
  }
  return { ok: true, data: { id, slug } }
}

/** Patch an event type — duration, its options, or hide/show it. */
export async function patchCalEventType(
  eventTypeId: number,
  patch: {
    lengthInMinutes?: number
    lengthInMinutesOptions?: number[]
    hidden?: boolean
  },
): Promise<CalResult<null>> {
  return calRequest<null>(`/event-types/${eventTypeId}`, "PATCH", patch)
}
