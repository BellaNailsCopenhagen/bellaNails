/**
 * The booking module's server surface — what pages and server components
 * import. It is transitively `server-only`: it reaches cookies, the
 * service-role client and storage.
 *
 * **Client components must not import this.** They import
 * `@/modules/booking/actions` for mutations, `@/shared/booking-*` for view
 * models and rules, and `@/db/*` for reactive reads.
 */

// Composed page reads — one call per surface.
export {
  getAdminAppointments,
  getAdminQueue,
  getBookingForManageAsOwner,
  getMyBookingForManage,
  getClientBookingHistory,
  getMyBookings,
  type AdminBookingView,
} from "./reads"

// In-house scheduler: available slots + booking creation.
// Client components import ./create-booking-actions directly (it's "use server").
export { getAvailableSlots, getMaxAdvanceDays } from "./availability"
export { createBooking } from "./create-booking-actions"
// Guest self-service: the manage page verifies the signed email-link token.
export { verifyBookingToken } from "./manage-token"

// Mutations. Re-exported for server callers; client components import
// ./actions directly so they never pull this barrel into the browser bundle.
export {
  cancelBooking,
  cancelBookingAsOwner,
  rescheduleBooking,
  rescheduleBookingAsOwner,
  setBookingNoShow,
} from "./actions"

// Server-side resolution helpers.
export { toDisplayBookings } from "./booking-view"
export { resolveAdminBookings } from "./admin-view"
export { getPendingRequests, type RequestView } from "./request-reads"
export { getBookingMediaThumbs } from "./booking-media"
