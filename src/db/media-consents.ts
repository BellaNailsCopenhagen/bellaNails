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

/** Published asset ids the client agreed to show ON THE WEBSITE. A
    social-only grant must never appear here — callers place these on public
    site surfaces. */
export async function listGrantedSiteAssetIds(db: Db): Promise<string[]> {
  const { data } = await db
    .from("media_consents")
    .select("published_asset_id")
    .eq("purpose", "site")
    .eq("status", "granted")
    .not("published_asset_id", "is", null)
  return [
    ...new Set(
      (data ?? [])
        .map((c) => c.published_asset_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
}

/** Granted site consents for a set of images, with the published copy they
    point at — the public service gallery joins through these. */
export async function listGrantedSitePublications(
  db: Db,
  mediaIds: string[],
): Promise<{ client_media_id: string; published_asset_id: string }[]> {
  if (mediaIds.length === 0) return []
  const { data } = await db
    .from("media_consents")
    .select("client_media_id, published_asset_id")
    .in("client_media_id", mediaIds)
    .eq("purpose", "site")
    .eq("status", "granted")
    .not("published_asset_id", "is", null)
  return (data ?? []).flatMap((c) =>
    c.published_asset_id
      ? [{ client_media_id: c.client_media_id, published_asset_id: c.published_asset_id }]
      : [],
  )
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

/** The published copy one consent points at, if any. */
export async function getPublishedAssetId(
  db: Db,
  consentId: string,
): Promise<{ found: boolean; assetId: string | null }> {
  const { data } = await db
    .from("media_consents")
    .select("published_asset_id")
    .eq("id", consentId)
    .maybeSingle()
  return data
    ? { found: true, assetId: data.published_asset_id }
    : { found: false, assetId: null }
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

/** The consent row plus its published copy — the withdrawal path needs both. */
export async function findConsentWithAsset(
  db: Db,
  mediaId: string,
  purpose: ConsentPurpose,
): Promise<Pick<Row<"media_consents">, "id" | "client_id" | "published_asset_id"> | null> {
  const { data } = await db
    .from("media_consents")
    .select("id, client_id, published_asset_id")
    .eq("client_media_id", mediaId)
    .eq("purpose", purpose)
    .maybeSingle()
  return data ?? null
}

/** Every request this client has not answered yet. */
export async function listRequestedFor(
  db: Db,
  clientId: string,
): Promise<Pick<Row<"media_consents">, "id" | "client_media_id">[]> {
  const { data } = await db
    .from("media_consents")
    .select("id, client_media_id")
    .eq("client_id", clientId)
    .eq("status", "requested")
  return data ?? []
}

/** Does any consent on this image show artist use — published, granted, or
    flagged for auto-placement? Conservative by design: erasure keeps such an
    image, and the client's lever for it is consent withdrawal, not deletion. */
export async function hasArtistUseSignal(
  db: Db,
  mediaId: string,
): Promise<boolean> {
  const { data } = await db
    .from("media_consents")
    .select("id")
    .eq("client_media_id", mediaId)
    .or("published_asset_id.not.is.null,status.eq.granted,auto_place.eq.true")
    .limit(1)
  return Boolean(data?.length)
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

/** How many of an image's consents produced a published copy — gates the
    "shared image deleted" owner notification. */
export async function countPublishedConsents(
  db: Db,
  mediaId: string,
): Promise<number> {
  const { count } = await db
    .from("media_consents")
    .select("id", { count: "exact", head: true })
    .eq("client_media_id", mediaId)
    .not("published_asset_id", "is", null)
  return count ?? 0
}

/** Upsert several consent rows at once (request site + social together). */
export async function upsertConsents(
  db: Db,
  values: ConsentUpsert[],
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
