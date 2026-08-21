/**
 * The `bookings.status` vocabulary — the schema column is a plain string, so
 * this const is the single contract between the writers (the booking create /
 * cancel / reschedule actions) and readers (the /appointments page, admin
 * queue). Never write a literal.
 */
export const BOOKING_STATUS = {
  confirmed: "confirmed",
  rescheduled: "rescheduled",
  cancelled: "cancelled",
} as const

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

/** Statuses that count as a live appointment. Future statuses (requested,
    declined — see PLAN Phase 8) are NOT active until explicitly added, so
    every "upcoming" reader inherits the right default. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUS.confirmed,
  BOOKING_STATUS.rescheduled,
]

export function isActiveBookingStatus(status: string): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status)
}
