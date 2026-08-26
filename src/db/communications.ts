import { redactedEmail } from "@/shared/anonymize"

import type { Db, Insert, Row } from "./client"

/** `communications` — the transactional-message log (one row per send + trigger).
    Only the service-role client touches it (RLS denies everyone else). Reads
    throw on a real error; the caller degrades. */

export type CommunicationRow = Row<"communications">

export async function insertCommunication(
  db: Db,
  values: Insert<"communications">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("communications").insert(values)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** A client's log, newest first — the admin client-page history. */
export async function listCommunicationsForClient(
  db: Db,
  clientId: string,
): Promise<CommunicationRow[]> {
  const { data, error } = await db
    .from("communications")
    .select(
      "id, client_id, booking_id, kind, trigger, channel, recipient, reminder_for, status, error, created_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Successful reminders already sent for these bookings, each with the
    appointment time it was for. The run skips a booking only when it was already
    reminded FOR ITS CURRENT start — so a reschedule to a new time re-reminds, and
    a failed/skipped reminder re-sends. */
export async function listSentReminders(
  db: Db,
  bookingIds: string[],
): Promise<{ bookingId: string; reminderFor: string | null }[]> {
  if (bookingIds.length === 0) return []
  const { data, error } = await db
    .from("communications")
    .select("booking_id, reminder_for")
    .eq("kind", "reminder")
    .eq("status", "sent")
    .in("booking_id", bookingIds)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((r): r is { booking_id: string; reminder_for: string | null } =>
      Boolean(r.booking_id),
    )
    .map((r) => ({ bookingId: r.booking_id, reminderFor: r.reminder_for }))
}

/** GDPR erasure — scrub the only PII (the recipient email) and KEEP the metadata
    log (kind/channel/status/when), like the anonymized bookings it trails. */
export async function scrubCommunicationsForClient(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("communications")
    .update({ recipient: redactedEmail(clientId) })
    .eq("client_id", clientId)
  return error ? { ok: false, message: error.message } : { ok: true }
}
