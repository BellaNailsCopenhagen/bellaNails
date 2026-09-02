/**
 * Design requests: a client's async ask, the conversation on it, the reference
 * photos, and the artist's one-time OFFER — a duration and a price set for that job, reached
 * by a signed link and booked through the ordinary booking flow.
 *
 * **Client components must not import this** — it is transitively
 * `server-only`. They import the `*-actions` files directly.
 */

// Reads.
export {
  getMyDesignRequests,
  getOfferByToken,
  getOpenDesignRequestCount,
  getOpenDesignRequests,
  type DesignMessageView,
  type DesignOfferView,
  type DesignRefView,
  type DesignQueue,
  type DesignRequestView,
  type OfferPageData,
} from "./reads"

// The signed offer link.
export { offerUrlFor, verifyOfferToken } from "./offer-token"

// Retention + erasure.
export { purgeDesignRefsForClient, purgeExpiredDesignRefs } from "./refs"

// Writes. Re-exported for server callers; client components import the
// ./*-actions modules directly.
export {
  addDesignMessage,
  addDesignRef,
  createDesignRequest,
  declineDesignRequest,
  markDesignThreadsSeen,
  replyToDesignRequest,
} from "./request-actions"
export { discardUploadedRef } from "./ref-actions"
export {
  bookOfferAsOwner,
  bookOfferByToken,
  createOffer,
  runDesignHousekeeping,
  withdrawOffer,
} from "./offer-actions"
