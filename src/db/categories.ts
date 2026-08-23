import type { Db, Insert, Row, Update } from "./client"

/** `categories` — the public menu's top level, and the admin catalog's
    grouping. Ordered by `sort_order` everywhere. */

export type AdminCategoryRow = Pick<
  Row<"categories">,
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "image_url"
  | "sort_order"
  | "archived_at"
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

// ---------------------------------------------------------------- reads

/** Every category including archived — the admin catalog's grouping. */
export async function listAdminCategories(
  db: Db,
): Promise<AdminCategoryRow[]> {
  const { data, error } = await db
    .from("categories")
    .select(
      "id, name_en, name_dk, description_en, description_dk, image_url, sort_order, archived_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
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

export type CategoryName = Pick<Row<"categories">, "id" | "name_en" | "name_dk">

/** Active names in both languages — the uniqueness check compares in JS. */
export async function listActiveCategoryNames(
  db: Db,
): Promise<CategoryName[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name_en, name_dk")
    .is("archived_at", null)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** The next free slot at the end of the menu, or null if it can't be read —
    an unordered category sorts last anyway (NULLS LAST), which is where a new
    one belongs. Never guess 0: that would put it first. */
export async function nextCategorySortOrder(
  db: Db,
): Promise<number | null> {
  const { data, error } = await db
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data?.sort_order ?? -1) + 1
}

// --------------------------------------------------------------- writes

export async function insertCategory(
  db: Db,
  values: Insert<"categories">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("categories")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false, message: error?.message ?? "no row" }
  return { ok: true, id: data.id }
}

/** `ok` is false when the id matched nothing — PostgREST reports no error for
    a zero-row update, so the returned row is the only proof of the write. */
export async function updateCategory(
  db: Db,
  id: string,
  values: Update<"categories">,
): Promise<{ ok: boolean }> {
  const { data, error } = await db
    .from("categories")
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  return { ok: !error && Boolean(data) }
}

/** Soft delete / restore. `at` is null to un-archive. */
export async function setCategoryArchived(
  db: Db,
  id: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { data, error } = await db
    .from("categories")
    .update({ archived_at: at })
    .eq("id", id)
    .select("id")
    .maybeSingle()
  return { ok: !error && Boolean(data) }
}

/** Renumber the menu positionally from a full ordered id list. Rewriting every
    row (the menu is a handful of categories) also heals null/duplicate slots.
    Not atomic — a false `ok` means SOME rows may already carry a new slot, so
    the caller must tell the owner to reload rather than "nothing happened". */
export async function setCategoryOrder(
  db: Db,
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db.from("categories").update({ sort_order: index }).eq("id", id),
    ),
  )
  return { ok: results.every((result) => !result.error) }
}
