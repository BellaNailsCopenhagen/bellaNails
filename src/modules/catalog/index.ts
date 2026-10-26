/**
 * The catalog module's server surface: services, add-ons, categories, content
 * sections and reviews.
 *
 * **Client components must not import this** — it is transitively
 * `server-only`. They import the `*-actions` files directly (each is
 * `"use server"`, so it is safe to reference from the browser).
 */

// Public reads (anon).
export {
  getFeaturedServices,
  getPublicService,
  getServiceMenu,
  getServiceWithAddons,
  type BookableService,
  type FeaturedService,
  type MenuCategory,
  type MenuService,
  type PublicService,
  type ServiceAddon,
  type ServiceWithAddons,
} from "./public-catalog"

// Admin reads (service-role, owner-gated route).
export {
  getAdminCatalog,
  getAllAddons,
  getAllIncompatibilities,
  getServiceDetail,
  type AdminAddon,
  type AdminCatalog,
  type AdminCategory,
  type AdminService,
  type ServiceDetail,
} from "./admin-catalog"

export {
  getServiceSections,
  getConsentedAssets,
  type ServiceSection,
  type PickableAsset,
} from "./sections"
export { getServiceReviews, type Review } from "./reviews"
export {
  getServicePublicGallery,
  type PublicAsset,
  type ServiceGallery,
} from "./service-gallery"

// Writes. Re-exported for server callers; client components import the
// ./*-actions modules directly.
export {
  archiveService,
  createService,
  getPriceHistory,
  updateService,
} from "./service-actions"
export type { PriceEntity, PricePoint } from "@/db/price-history"
export {
  archiveAddon,
  linkAddon,
  saveAddon,
  setAddonCompatibility,
  unlinkAddon,
} from "./addon-actions"
export { archiveCategory, moveCategory, saveCategory } from "./category-actions"
export type {
  AddonEditInput,
  CategoryInput,
  ServiceActionResult,
  ServiceCreateInput,
  ServiceEditInput,
} from "./types"
