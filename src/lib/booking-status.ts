/**
 * The `bookings.status` vocabulary — the schema column is a plain string, so
 * this const is the single contract between the writer (the Cal webhook) and
 * readers (the /bookings page, admin queue). Never write a literal.
 */
export const BOOKING_STATUS = {
  confirmed: "confirmed",
  rescheduled: "rescheduled",
  cancelled: "cancelled",
} as const;

export type BookingStatus =
  (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
