import type { Db } from "./client"

/** `price_history` — an append-only price point per catalog item. Writes are
    best-effort: a history failure must never fail the catalog save. */

export type PriceEntity = "service" | "addon"
export type PricePoint = { priceCents: number; changedAt: string }

/** Price points for one item, newest first. */
export async function listPriceHistory(
  db: Db,
  entityType: PriceEntity,
  entityId: string,
): Promise<PricePoint[]> {
  const { data } = await db
    .from("price_history")
    .select("price_cents, changed_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("changed_at", { ascending: false })

  return (data ?? []).map((r) => ({
    priceCents: r.price_cents,
    changedAt: r.changed_at,
  }))
}

/** Append a price point. Swallows every failure by design — see the file
    comment; the table may also not be applied yet in a fresh environment. */
export async function recordPricePoint(
  db: Db,
  entityType: PriceEntity,
  entityId: string,
  priceCents: number,
): Promise<void> {
  try {
    await db.from("price_history").insert({
      entity_type: entityType,
      entity_id: entityId,
      price_cents: priceCents,
    })
  } catch {
    // Never let a price-history write break the catalog save.
  }
}
