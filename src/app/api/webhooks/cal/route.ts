import { createHmac, timingSafeEqual } from "node:crypto";

import { ensureClerkUser } from "@/lib/clerk/ensure-user";
import { BOOKING_STATUS, type BookingStatus } from "@/lib/booking-status";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CALCOM_BOOKING_ORIGIN } from "@/config/calcom";

/**
 * Cal.com webhook (EU instance) — the single write path into `bookings`.
 *
 * Every delivery is HMAC-verified against `CALCOM_WEBHOOK_SECRET` before the
 * body is trusted. `BOOKING_CREATED` and `BOOKING_RESCHEDULED` both upsert
 * the full payload (Cal issues a NEW bookingId on reschedule, so an
 * update-by-old-id would miss the row — the original then gets its own
 * `BOOKING_CANCELLED`). `BOOKING_CANCELLED` updates by id; a zero-row match
 * returns 500 so Cal retries (heals out-of-order delivery). Identity: the
 * attendee email resolves to a Clerk user via `ensureClerkUser` — no client
 * PII is written to our DB.
 *
 * Register in Cal (Settings → Developer → Webhooks) only after this route is
 * deployed; subscribed triggers: created / rescheduled / cancelled.
 */

/** Cal's standard (non-custom-template) payload — only the fields we read. */
type CalWebhookEvent = {
  triggerEvent: string;
  payload: {
    bookingId?: number;
    uid?: string;
    /** On BOOKING_RESCHEDULED: the uid of the ORIGINAL (replaced) booking. */
    rescheduleUid?: string;
    status?: string;
    startTime?: string;
    endTime?: string;
    attendees?: {
      email?: string;
      name?: string;
      phoneNumber?: string;
    }[];
    responses?: {
      attendeePhoneNumber?: { value?: string };
    };
    metadata?: Record<string, unknown>;
  };
};

function verifySignature(secret: string, rawBody: string, header: string | null) {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** `metadata[totalPriceCents]` arrives as a string — parse defensively. */
function metaInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

function metaString(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function persistFailed(context: string, message: string) {
  console.error(`[cal-webhook] ${context}: ${message}`);
  // 5xx → Cal retries; every write here is idempotent.
  return new Response("Persist failed", { status: 500 });
}

export async function POST(request: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");
  if (!verifySignature(secret, rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: CalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CalWebhookEvent;
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }

  switch (event.triggerEvent) {
    case "BOOKING_CREATED":
      return persistBooking(event.payload, BOOKING_STATUS.confirmed);
    case "BOOKING_RESCHEDULED":
      return persistBooking(event.payload, BOOKING_STATUS.rescheduled);
    case "BOOKING_CANCELLED":
      return markCancelled(event.payload);
    default:
      // Unsubscribed/unknown trigger — acknowledge so Cal doesn't retry.
      return Response.json({ ignored: event.triggerEvent });
  }
}

/** Full upsert for created AND rescheduled (reschedule = new bookingId). */
async function persistBooking(
  payload: CalWebhookEvent["payload"],
  status: BookingStatus,
) {
  const { bookingId, uid, startTime, endTime } = payload;
  const attendee = payload.attendees?.[0];

  if (!bookingId || !uid || !startTime || !endTime || !attendee?.email) {
    // Not retryable — acknowledge and surface in logs instead of 4xx-ing,
    // so Cal doesn't hammer us over a payload shape we'll never accept.
    console.error("[cal-webhook] booking payload missing fields", {
      status,
      bookingId,
      uid,
      hasAttendee: Boolean(attendee?.email),
    });
    return Response.json({ skipped: "missing fields" });
  }

  const supabase = createSupabaseServiceRoleClient();

  // Duplicate delivery? Skip the Clerk round-trips entirely — the row (and
  // its user) already exist, and the upsert below is what guarantees
  // idempotency for the race where two deliveries pass this check at once.
  const { data: existing } = await supabase
    .from("bookings")
    .select("cal_booking_id, status")
    .eq("cal_booking_id", bookingId)
    .maybeSingle();
  if (existing && existing.status === status) {
    return Response.json({ ok: true, duplicate: true });
  }

  let clerkUserId: string;
  try {
    clerkUserId = await ensureClerkUser({
      email: attendee.email,
      name: attendee.name,
      phone:
        payload.responses?.attendeePhoneNumber?.value ?? attendee.phoneNumber,
    });
  } catch (error) {
    // Clerk outage/rate limit — controlled 500 so Cal retries later instead
    // of the route crashing; nothing was written yet.
    return persistFailed(
      "ensureClerkUser failed",
      error instanceof Error ? error.message : String(error),
    );
  }

  // IDs-only machine metadata from the embed handoff — the human notes
  // string is never parsed.
  const meta = payload.metadata ?? {};
  const addonIds = metaString(meta.addonIds)?.split(",").filter(Boolean) ?? [];

  const { error } = await supabase.from("bookings").upsert(
    {
      cal_booking_id: bookingId,
      clerk_user_id: clerkUserId,
      status,
      start_time: startTime,
      end_time: endTime,
      // Canonical Cal cloud URL forms, built from the booking uid — the
      // payload carries no ready-made links. Validated on the first real
      // booking (see task acceptance).
      reschedule_url: `${CALCOM_BOOKING_ORIGIN}/reschedule/${uid}`,
      cancel_url: `${CALCOM_BOOKING_ORIGIN}/booking/${uid}?cancel=true`,
      total_price_cents: metaInt(meta.totalPriceCents) ?? 0,
      selected_addons: {
        serviceId: metaString(meta.serviceId),
        addonIds,
        totalDurationMins: metaInt(meta.totalDurationMins),
        locale: metaString(meta.locale),
      },
    },
    { onConflict: "cal_booking_id" },
  );

  if (error) return persistFailed("bookings upsert failed", error.message);

  // A reschedule replaces the old booking with this new one, and Cal fires
  // no BOOKING_CANCELLED for the original — close it out here. We have no
  // uid column, but the stored cancel_url embeds the uid exactly.
  if (status === BOOKING_STATUS.rescheduled && payload.rescheduleUid) {
    const oldCancelUrl = `${CALCOM_BOOKING_ORIGIN}/booking/${payload.rescheduleUid}?cancel=true`;
    const { error: oldError } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.cancelled })
      .eq("cancel_url", oldCancelUrl)
      .neq("cal_booking_id", bookingId);
    if (oldError) {
      // New row is safe; log the stale original rather than failing the
      // delivery (a retry would just re-run the same idempotent writes).
      console.error(
        "[cal-webhook] failed to close replaced booking",
        oldError.message,
      );
    }
  }

  return Response.json({ ok: true });
}

async function markCancelled(payload: CalWebhookEvent["payload"]) {
  if (!payload.bookingId) {
    console.error("[cal-webhook] BOOKING_CANCELLED without bookingId");
    return Response.json({ skipped: "missing bookingId" });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_booking_id", payload.bookingId)
    .select("cal_booking_id");

  if (error) return persistFailed("bookings cancel failed", error.message);
  if (!data?.length) {
    // No row yet — deliveries can arrive out of order. 5xx so Cal retries
    // once the BOOKING_CREATED upsert has landed.
    return persistFailed(
      "bookings cancel matched no row",
      `cal_booking_id=${payload.bookingId}`,
    );
  }
  return Response.json({ ok: true });
}
