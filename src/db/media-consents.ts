import type { Db, Insert, Row, Update } from "./client"

/** `media_consents` — one row per (image, purpose), recording whether the
    client agreed to publish it. `published_asset_id` points at the public copy
    created on grant; clearing it is how a takedown is recorded. */

export type ConsentPurpose = "site" | "some"

export type ConsentStateRow = Pick<
  Row<"media_consents">,
  "client_media_id" | "purpose" | "status"
>

export type HubConsentRow = Pick<
  Row<"media_consents">,
  | "id"
  | "client_media_id"
  | "purpose"
  | "status"
  | "published_asset_id"
  | "needs_takedown_at"
>

/** Consent state for a set of images — the client's own gallery. */
export async function listConsentStates(
  db: Db,
  mediaIds: string[],
): Promise<ConsentStateRow[]> {
  if (mediaIds.length === 0) return []
  const { data } = await db
    .from("media_consents")
    .select("client_media_id, purpose, status")
    .in("client_media_id", mediaIds)
  return data ?? []
}

/** Full consent rows for the asset hub. */
export async function listHubConsents(
  db: Db,
  mediaIds: string[],
): Promise<HubConsentRow[]> {
  if (mediaIds.length === 0) return []
  const { data } = await db
    .from("media_consents")
    .select(
      "id, client_media_id, purpose, status, published_asset_id, needs_takedown_at",
    )
    .in("client_media_id", mediaIds)
  return data ?? []
}

/** Site-purpose consent for a batch — the request fan-out reads it to skip
    images the client already said yes to. */
export async function listSiteConsentsFor(
  db: Db,
  mediaIds: string[],
): Promise<
  Pick<Row<"media_consents">, "client_media_id" | "status" | "published_asset_id">[]
> {
  if (mediaIds.length === 0) return []
  const { data } = await db
    .from("media_consents")
    .select("client_media_id, status, published_asset_id")
    .eq("purpose", "site")
    .in("client_media_id", mediaIds)
  return data ?? []
}

/** The consent row for one image + purpose, with its owner — every client
    decision authorizes against this. */
export async function findConsent(
  db: Db,
  mediaId: string,
  purpose: ConsentPurpose,
): Promise<Pick<Row<"media_consents">, "id" | "client_id" | "status"> | null> {
  const { data } = await db
    .from("media_consents")
    .select("id, client_id, status")
    .eq("client_media_id", mediaId)
    .eq("purpose", purpose)
    .maybeSingle()
  return data ?? null
}

/** Auto-placement flag — may be absent in an environment without the column,
    so callers treat a throw as "feature not available". */
export async function getConsentAutoPlace(
  db: Db,
  consentId: string,
): Promise<Pick<Row<"media_consents">, "auto_place" | "purpose"> | null> {
  const { data } = await db
    .from("media_consents")
    .select("auto_place, purpose")
    .eq("id", consentId)
    .maybeSingle()
  return data ?? null
}

/** Which purpose a published asset was granted for — the placement guard. */
export async function getPurposeForPublishedAsset(
  db: Db,
  assetId: string,
): Promise<string | null> {
  const { data } = await db
    .from("media_consents")
    .select("purpose")
    .eq("published_asset_id", assetId)
    .maybeSingle()
  return data?.purpose ?? null
}

/** Published copies of one image — what erasure must destroy. */
export async function listPublishedConsentsFor(
  db: Db,
  mediaId: string,
): Promise<Pick<Row<"media_consents">, "id" | "published_asset_id">[]> {
  const { data } = await db
    .from("media_consents")
    .select("id, published_asset_id")
    .eq("client_media_id", mediaId)
    .not("published_asset_id", "is", null)
  return data ?? []
}

/** How many of an image's consents are live (granted) — gates the
    "shared image deleted" owner notification. */
export async function countGrantedConsents(
  db: Db,
  mediaId: string,
): Promise<number> {
  const { count } = await db
    .from("media_consents")
    .select("id", { count: "exact", head: true })
    .eq("client_media_id", mediaId)
    .eq("status", "granted")
  return count ?? 0
}

/** Requests awaiting this client's decision. */
export async function countRequestedFor(
  db: Db,
  clientId: string,
): Promise<number> {
  const { count } = await db
    .from("media_consents")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "requested")
  return count ?? 0
}

export type ConsentUpsert = Insert<"media_consents">

export async function upsertConsent(
  db: Db,
  values: ConsentUpsert,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("media_consents")
    .upsert(values, { onConflict: "client_media_id,purpose" })
  return { ok: !error }
}

export async function updateConsent(
  db: Db,
  consentId: string,
  values: Update<"media_consents">,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("media_consents")
    .update(values)
    .eq("id", consentId)
  return { ok: !error }
}

/** Forget the published copy — after the asset row and file are destroyed. */
export async function clearPublishedAsset(
  db: Db,
  consentId: string,
): Promise<{ ok: boolean }> {
  return updateConsent(db, consentId, { published_asset_id: null })
}
