/** Shared shapes for the catalog module. Kept out of the `"use server"` files,
    which may only export async functions. */

export type ServiceActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type ServiceEditInput = {
  nameEn: string
  nameDa: string
  descriptionEn: string
  descriptionDa: string
  priceKr: number
  durationMins: number
}

export type ServiceCreateInput = {
  nameEn: string
  nameDa: string
  priceKr: number
  durationMins: number
  categoryId: string | null
}

export type AddonEditInput = {
  nameEn: string
  nameDa: string
  priceKr: number
  durationMins: number
}
