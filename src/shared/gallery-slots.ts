/**
 * The home page's five gallery positions. Position 1 is the large lead image,
 * 2-5 the small tiles beside it; everything else shows on /gallery only.
 *
 * Pure and shared, because a client component draws the picker and a server
 * action validates the choice — and because a `"use server"` file may only
 * export async functions, so a constant living there reaches the browser as a
 * server reference rather than an array.
 */
export const GALLERY_SLOTS = [1, 2, 3, 4, 5] as const

export type GallerySlot = (typeof GALLERY_SLOTS)[number]

export function isGallerySlot(value: number): value is GallerySlot {
  return (GALLERY_SLOTS as readonly number[]).includes(value)
}
