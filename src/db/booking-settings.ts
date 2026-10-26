import type { Db, Row } from "./client"

export type BookingSettings = Row<"booking_settings">

/** `booking_settings` — a single-row table (`id` is the literal `true`) holding
    the global scheduling rules (slot interval, buffer, lead time, max advance). */
export async function getBookingSettings(
  db: Db,
): Promise<BookingSettings | null> {
  const { data } = await db
    .from("booking_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle()

  return data ?? null
}
