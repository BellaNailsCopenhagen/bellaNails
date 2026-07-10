import { createHmac, timingSafeEqual } from "node:crypto";

import { ensureClerkUser } from "@/lib/clerk/ensure-user";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CALCOM_BOOKING_ORIGIN } from "@/config/calcom";

/**
 * Cal.com webhook (EU instance) — the single write path into `bookings`.
 *
 * Every delivery is HMAC-verified against `CALCOM_WEBHOOK_SECRET` before the
 * body is trusted. `BOOKING_CREATED` upserts (idempotent on the unique
 * `cal_booking_id`), `BOOKING_RESCHEDULED`/`BOOKING_CANCELLED` update the
 * existing row. Identity: the attendee email resolves to a Clerk user via
 * `ensureClerkUser` — no client PII is written to our DB.
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
      return handleCreated(event.payload);
    case "BOOKING_RESCHEDULED":
      return handleRescheduled(event.payload);
    case "BOOKING_CANCELLED":
      return handleCancelled(event.payload);
    default:
      // Unsubscribed/unknown trigger — acknowledge so Cal doesn't retry.
      return Response.json({ ignored: event.triggerEvent });
  }
}

async function handleCreated(payload: CalWebhookEvent["payload"]) {
  const { bookingId, uid, startTime, endTime } = payload;
  const attendee = payload.attendees?.[0];

  if (!bookingId || !uid || !startTime || !endTime || !attendee?.email) {
    // Not retryable — acknowledge and surface in logs instead of 4xx-ing,
    // so Cal doesn't hammer us over a payload shape we'll never accept.
    console.error("[cal-webhook] BOOKING_CREATED missing fields", {
      bookingId,
      uid,
      hasAttendee: Boolean(attendee?.email),
    });
    return Response.json({ skipped: "missing fields" });
  }

  const clerkUserId = await ensureClerkUser({
    email: attendee.email,
    name: attendee.name,
    phone:
      payload.responses?.attendeePhoneNumber?.value ?? attendee.phoneNumber,
  });

  // IDs-only machine metadata from the embed handoff — the human notes
  // string is never parsed.
  const meta = payload.metadata ?? {};
  const totalPriceCents = metaInt(meta.totalPriceCents);
  const addonIds = metaString(meta.addonIds)?.split(",").filter(Boolean) ?? [];
  const selectedAddons = {
    serviceId: metaString(meta.serviceId),
    addonIds,
    totalDurationMins: metaInt(meta.totalDurationMins),
    locale: metaString(meta.locale),
  };

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("bookings").upsert(
    {
      cal_booking_id: bookingId,
      clerk_user_id: clerkUserId,
      status: "confirmed",
      start_time: startTime,
      end_time: endTime,
      // Canonical Cal cloud URL forms, built from the booking uid — the
      // payload carries no ready-made links. Validated on the first real
      // booking (see task acceptance).
      reschedule_url: `${CALCOM_BOOKING_ORIGIN}/reschedule/${uid}`,
      cancel_url: `${CALCOM_BOOKING_ORIGIN}/booking/${uid}?cancel=true`,
      total_price_cents: totalPriceCents ?? 0,
      selected_addons: selectedAddons,
    },
    { onConflict: "cal_booking_id" },
  );

  if (error) {
    console.error("[cal-webhook] bookings upsert failed", error.message);
    // 5xx so Cal retries — the write is idempotent.
    return new Response("Persist failed", { status: 500 });
  }

  return Response.json({ ok: true });
}

async function handleRescheduled(payload: CalWebhookEvent["payload"]) {
  return updateByBookingId(payload, {
    status: "rescheduled",
    ...(payload.startTime ? { start_time: payload.startTime } : {}),
    ...(payload.endTime ? { end_time: payload.endTime } : {}),
  });
}

async function handleCancelled(payload: CalWebhookEvent["payload"]) {
  return updateByBookingId(payload, { status: "cancelled" });
}

async function updateByBookingId(
  payload: CalWebhookEvent["payload"],
  patch: Database["public"]["Tables"]["bookings"]["Update"],
) {
  if (!payload.bookingId) {
    console.error("[cal-webhook] update without bookingId");
    return Response.json({ skipped: "missing bookingId" });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("cal_booking_id", payload.bookingId);

  if (error) {
    console.error("[cal-webhook] bookings update failed", error.message);
    return new Response("Persist failed", { status: 500 });
  }

  return Response.json({ ok: true });
}
