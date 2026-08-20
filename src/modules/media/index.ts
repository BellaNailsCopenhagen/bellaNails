/**
 * The media module's server surface: client photos, the consent lifecycle that
 * governs publishing them, and the published copies on public surfaces.
 *
 * **Client components must not import this** — it is transitively
 * `server-only`. They import the `*-actions` files directly.
 */

// Reads.
export {
  getClientMedia,
  getClientDataConsents,
  type ClientMediaItem,
  type ConsentStatus,
  type DataConsentItem,
  type MediaPurpose,
} from "./client-gallery"
export { getHubAssets, type HubAsset, type HubConsent, type HubUsage } from "./asset-hub"
export { pendingRequestCount } from "./consent-requests"
export { getPublicAssetsBySurface, type PublicAsset } from "./public-assets"
export {
  getGalleryPreviewItems,
  type GalleryPreviewItem,
} from "./gallery-preview"

// Erasure (GDPR Art. 17) — destroys storage artifacts; callers authorize first.
export { purgeMediaArtifacts } from "./erasure"

// Writes. Re-exported for server callers; client components import the
// ./*-actions modules directly.
export {
  acceptAllPendingConsents,
  decideDataConsent,
  decideMediaConsent,
  withdrawDataConsent,
  withdrawMediaConsent,
} from "./consent-actions"
export { addOwnBookingMedia, deleteOwnMedia } from "./client-media-actions"
export {
  addClientMedia,
  requestBothPublish,
  requestDataConsent,
  requestMediaPublish,
} from "./owner-media-actions"
export {
  bulkAddToGallery,
  confirmTakedown,
  setMediaDismissed,
  setMediaFavorite,
} from "./asset-actions"
export {
  addAssetUsage,
  removeAssetUsage,
} from "./usage-actions"
