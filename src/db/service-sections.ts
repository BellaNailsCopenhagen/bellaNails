import type { Db, Row } from "./client"

/** `service_sections` — the rich content blocks on a service detail page,
    ordered by `sort_order` within a service. */

export type SectionRow = Pick<
  Row<"service_sections">,
  | "id"
  | "sort_order"
  | "title_en"
  | "title_dk"
  | "body_en"
  | "body_dk"
  | "asset_id"
>

export async function listSectionsForService(
  db: Db,
  serviceId: string,
): Promise<SectionRow[]> {
  const { data } = await db
    .from("service_sections")
    .select("id, sort_order, title_en, title_dk, body_en, body_dk, asset_id")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: true })

  return data ?? []
}

/** The next free slot at the end of a service's section list. */
export async function nextSortOrder(
  db: Db,
  serviceId: string,
): Promise<number> {
  const { data } = await db
    .from("service_sections")
    .select("sort_order")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? -1) + 1
}

export type SectionFields = {
  title_en: string | null
  title_dk: string | null
  body_en: string | null
  body_dk: string | null
  asset_id: string | null
}

export async function insertSection(
  db: Db,
  serviceId: string,
  sortOrder: number,
  fields: SectionFields,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("service_sections")
    .insert({ service_id: serviceId, sort_order: sortOrder, ...fields })

  return { ok: !error }
}

/** Update a section, returning its service so the caller can revalidate. */
export async function updateSection(
  db: Db,
  sectionId: string,
  fields: SectionFields,
): Promise<{ ok: true; serviceId: string } | { ok: false }> {
  const { data, error } = await db
    .from("service_sections")
    .update(fields)
    .eq("id", sectionId)
    .select("service_id")
    .single()
  if (error || !data) {
    return { ok: false }
  }

  return { ok: true, serviceId: data.service_id }
}

export async function deleteSection(
  db: Db,
  sectionId: string,
): Promise<{ ok: true; serviceId: string } | { ok: false }> {
  const { data, error } = await db
    .from("service_sections")
    .delete()
    .eq("id", sectionId)
    .select("service_id")
    .single()
  if (error || !data) {
    return { ok: false }
  }

  return { ok: true, serviceId: data.service_id }
}

export type SectionPosition = Pick<
  Row<"service_sections">,
  "id" | "service_id" | "sort_order"
>

export async function getSectionPosition(
  db: Db,
  sectionId: string,
): Promise<SectionPosition | null> {
  const { data } = await db
    .from("service_sections")
    .select("id, service_id, sort_order")
    .eq("id", sectionId)
    .maybeSingle()

  return data ?? null
}

/** The section immediately before/after this one in sort order — the move
    action swaps their `sort_order` values. */
export async function getAdjacentSection(
  db: Db,
  serviceId: string,
  sortOrder: number,
  direction: "up" | "down",
): Promise<SectionPosition | null> {
  const q = db
    .from("service_sections")
    .select("id, service_id, sort_order")
    .eq("service_id", serviceId)
  const { data } =
    direction === "up"
      ? await q
          .lt("sort_order", sortOrder)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await q
          .gt("sort_order", sortOrder)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle()

  return data ?? null
}

export async function setSectionSortOrder(
  db: Db,
  sectionId: string,
  sortOrder: number,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("service_sections")
    .update({ sort_order: sortOrder })
    .eq("id", sectionId)

  return { ok: !error }
}

/** How many service sections still show this asset — checked before a published
    copy is deleted, because `service_sections.asset_id` is `on delete set null`
    and would silently leave a section with no image. THROWS: a failed count that
    returned 0 would green-light deleting a photo a live page still shows. */
export async function countSectionsUsingAsset(
  db: Db,
  assetId: string,
): Promise<number> {
  const { count, error } = await db
    .from("service_sections")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
  if (error) {
    throw new Error(`Failed to count sections: ${error.message}`)
  }

  return count ?? 0
}
