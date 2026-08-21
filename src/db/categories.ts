import type { Db, Row } from "./client"

/** `categories` — the public menu's top level, and the admin catalog's
    grouping. Ordered by `sort_order` everywhere. */

export type AdminCategoryRow = Pick<
  Row<"categories">,
  "id" | "name_en" | "name_dk" | "sort_order" | "archived_at"
>

export type MenuServiceRow = Pick<
  Row<"services">,
  "id" | "name_en" | "name_dk" | "base_price_cents" | "base_duration_mins"
>

export type MenuCategoryRow = Pick<
  Row<"categories">,
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "image_url"
> & { services: MenuServiceRow[] }

/** Every category including archived — the admin catalog's grouping. */
export async function listAdminCategories(
  db: Db,
): Promise<AdminCategoryRow[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name_en, name_dk, sort_order, archived_at")
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Active categories with their active services embedded, both in display
    order. Callers filter out categories left with nothing bookable. */
export async function listMenuCategories(
  db: Db,
): Promise<MenuCategoryRow[]> {
  const { data, error } = await db
    .from("categories")
    .select(
      "id, name_en, name_dk, description_en, description_dk, image_url, services(id, name_en, name_dk, base_price_cents, base_duration_mins)",
    )
    .is("archived_at", null)
    .is("services.archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { referencedTable: "services", ascending: true })
  if (error) {
    throw new Error(`Failed to load the service menu: ${error.message}`)
  }
  return (data ?? []) as MenuCategoryRow[]
}

/** One category's English name — the admin service detail breadcrumb. */
export async function getCategoryName(
  db: Db,
  id: string,
): Promise<string | null> {
  const { data } = await db
    .from("categories")
    .select("name_en")
    .eq("id", id)
    .maybeSingle()
  return data?.name_en ?? null
}
