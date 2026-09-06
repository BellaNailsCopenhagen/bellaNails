/**
 * The media module's server surface: client photos/videos, the booking-level
 * RELEASE lifecycle that governs publishing them, and the published copies on
 * public surfaces.
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
} from "./client-gallery"
export {
  getHubAssets,
  type HubAsset,
  type HubPublished,
  type HubUsage,
} from "./asset-hub"
export { pendingRequestCount } from "./consent-requests"
export { getReleaseRequestForToken } from "./release-reads"
export { getPublicAssetsBySurface, type PublicAsset } from "./public-assets"
export {
  getGalleryPreviewItems,
  type GalleryPreviewItem,
} from "./gallery-preview"

// Erasure (GDPR Art. 17) — destroys storage artifacts; callers authorize first.
export { purgeMediaArtifacts } from "./erasure"

// Writes. Re-exported for server callers; client components import the
// ./*-actions modules directly.
export { decideDataConsent, withdrawDataConsent } from "./consent-actions"
export {
  decideMediaRelease,
  respondToReleaseToken,
  withdrawMediaRelease,
} from "./release-actions"
export {
  addClientMedia,
  requestDataConsent,
  requestMediaRelease,
} from "./owner-media-actions"
export {
  bulkAddToGallery,
  confirmTakedown,
  placeMedia,
  setMediaSetAside,
  setMediaFavorite,
} from "./asset-actions"
export { removeAssetUsage, setPlacementLink } from "./usage-actions"
