import type { Db, Row } from "./client"

/** `booking_protection` — ONE row (boolean PK) holding the booking access level
    and the human-check switch. Public-read (the booking form has to know what to
    ask for); owner-written through a service-role action. */

export type BookingProtectionRow = Row<"booking_protection">

/** The row, or null when the table isn't there / has no row yet — the caller
    supplies the default, because "unreadable" must mean "stay safe", not "off". */
export async function getBookingProtection(
  db: Db,
): Promise<BookingProtectionRow | null> {
  const { data } = await db.from("booking_protection").select("*").maybeSingle()

  return data ?? null
}

export async function upsertBookingProtection(
  db: Db,
  values: { access_level?: string; human_check?: boolean },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("booking_protection")
    .upsert(
      { id: true, ...values, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )

  return error ? { ok: false, message: error.message } : { ok: true }
}
