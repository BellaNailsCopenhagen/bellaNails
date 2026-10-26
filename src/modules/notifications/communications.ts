import "server-only"

import {
  insertCommunication,
  listCommunicationsForClient,
} from "@/db/communications"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { requireOwner } from "@/modules/identity/require-owner"

/**
 * The transactional-message log. `recordCommunication` is best-effort — a log
 * failure must never break the send it trails — and always uses the service-role
 * client (the log is owner/system data). `getClientCommunications` backs the
 * admin client-page history.
 */

// Outbound messages TO A CLIENT. Grows with new client-facing sends (photo-consent
// / video-approval requests, added WITH the feature that sends them). Owner-facing
// alerts (e.g. a client withdrawing consent) belong in owner_notifications, not here.
export type CommunicationKind =
  | "confirmation"
  | "cancellation"
  | "reschedule"
  | "reminder"
  | "media_release_request"
  | "review_request"
  | "booking_request_received"
  | "booking_request_declined"
  | "design_request_received"
  | "design_reply"
  | "design_offer_sent"
  | "design_request_declined"
  | "testimonial_request"
export type CommunicationTrigger = "auto" | "manual"
export type CommunicationChannel = "email" | "in_app" | "push"
// `sent` = accepted by the mail server (NOT proof of inbox delivery — plain SMTP
// gives no bounce feedback; a delivered/bounced state needs a provider webhook).
// `failed` = a send-time error (auth, 5xx reject, timeout). `skipped` = no-op
// (SMTP creds unset).
export type CommunicationStatus = "sent" | "failed" | "skipped"

export async function recordCommunication(input: {
  clientId: string
  bookingId: string | null
  kind: CommunicationKind
  trigger: CommunicationTrigger
  recipient: string | null
  status: CommunicationStatus
  error?: string | null
  /** Delivery channel — defaults to email; in_app / push land with the PWA. */
  channel?: CommunicationChannel
  /** Reminders only — the appointment start this was for (idempotency key). */
  reminderFor?: string | null
}): Promise<void> {
  try {
    const res = await insertCommunication(createSupabaseServiceRoleClient(), {
      client_id: input.clientId,
      booking_id: input.bookingId,
      kind: input.kind,
      trigger: input.trigger,
      channel: input.channel ?? "email",
      recipient: input.recipient,
      status: input.status,
      error: input.error ?? null,
      reminder_for: input.reminderFor ?? null,
    })
    // Best-effort, but never silent — a rejected insert (constraint, etc.) is logged.
    if (!res.ok) {
      console.error("[communications] log insert rejected —", res.message)
    }
  } catch (error) {
    console.error(
      "[communications] log failed —",
      error instanceof Error ? error.message : error,
    )
  }
}

/** The log status for an email send outcome — one mapping shared by all callers
    (sent = accepted, skipped = no-op/unconfigured, failed = real send error). */
export function statusFromEmailResult(res: {
  ok: boolean
  skipped?: boolean
}): CommunicationStatus {
  return res.ok ? "sent" : res.skipped ? "skipped" : "failed"
}

// No `recipient` here — the email is PII and the admin history doesn't render it
// (it stays in the DB for audit, wiped on erasure).
export type CommunicationView = {
  id: string
  kind: CommunicationKind
  trigger: CommunicationTrigger
  channel: CommunicationChannel
  status: CommunicationStatus
  createdAt: string
}

/** A client's log for the admin page — degrades to [] (never throws the page). */
export async function getClientCommunications(
  clientId: string,
): Promise<CommunicationView[]> {
  try {
    const db = await requireOwner()
    if (!db) {
      return []
    }
    const rows = await listCommunicationsForClient(db, clientId)

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as CommunicationKind,
      trigger: r.trigger as CommunicationTrigger,
      channel: r.channel as CommunicationChannel,
      status: r.status as CommunicationStatus,
      createdAt: r.created_at,
    }))
  } catch (error) {
    console.error(
      "[communications] read failed —",
      error instanceof Error ? error.message : error,
    )

    return []
  }
}
