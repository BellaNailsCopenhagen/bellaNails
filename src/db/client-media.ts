import type { Db, Row } from "./client"

/** `client_media` — every photo the studio or a client uploaded, private by
    default. `archived_at` is a soft delete: every read filters it out. */

const OWN_COLUMNS =
  "id, source, kind, url, storage_key, caption, service_id, booking_id, in_gallery, created_at"

const HUB_COLUMNS =
  "id, client_id, url, storage_key, kind, caption, created_at, source, dismissed_at, favorited_at"

export type OwnMediaRow = Pick<
  Row<"client_media">,
  | "id"
  | "source"
  | "kind"
  | "url"
  | "storage_key"
  | "caption"
  | "service_id"
  | "booking_id"
  | "in_gallery"
  | "created_at"
>

export type HubMediaRow = Pick<
  Row<"client_media">,
  | "id"
  | "client_id"
  | "url"
  | "storage_key"
  | "kind"
  | "caption"
  | "created_at"
  | "source"
  | "dismissed_at"
  | "favorited_at"
>

export type MediaThumbRow = Pick<
  Row<"client_media">,
  "id" | "booking_id" | "url" | "storage_key" | "kind"
>

/** One client's live media, newest first. */
export async function listMediaForClient(
  db: Db,
  clientId: string,
): Promise<OwnMediaRow[]> {
  const { data, error } = await db
    .from("client_media")
    .select(OWN_COLUMNS)
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Media attached to a set of bookings — the admin card thumbnails. */
export async function listMediaForBookings(
  db: Db,
  bookingIds: string[],
): Promise<MediaThumbRow[]> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  if (!ids.length) return []
  const { data, error } = await db
    .from("client_media")
    .select("id, booking_id, url, storage_key, kind")
    .in("booking_id", ids)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  if (error) return []
  return data ?? []
}

/** The asset hub's feed — every live image, or one client's. */
export async function listHubMedia(
  db: Db,
  clientId?: string,
): Promise<HubMediaRow[]> {
  const base = db
    .from("client_media")
    .select(HUB_COLUMNS)
    .is("archived_at", null)
  const { data, error } = await (
    clientId ? base.eq("client_id", clientId) : base
  ).order("created_at", { ascending: false })
  if (error) return []
  return (data ?? []) as HubMediaRow[]
}

/** Live images attached to a service — the public service gallery. */
export async function listMediaForService(
  db: Db,
  serviceId: string,
): Promise<Pick<Row<"client_media">, "id" | "source">[]> {
  const { data } = await db
    .from("client_media")
    .select("id, source")
    .eq("service_id", serviceId)
    .is("archived_at", null)
  return data ?? []
}

/** Owner of each media id — the consent-request fan-out needs it. */
export async function listMediaOwners(
  db: Db,
  mediaIds: string[],
): Promise<Pick<Row<"client_media">, "id" | "client_id">[]> {
  if (mediaIds.length === 0) return []
  const { data } = await db
    .from("client_media")
    .select("id, client_id")
    .in("id", mediaIds)
  return data ?? []
}

/** The client's own images the erasure sweep considers. */
export async function listOwnUploadsForClient(
  db: Db,
  clientId: string,
): Promise<Pick<Row<"client_media">, "id" | "favorited_at">[]> {
  const { data } = await db
    .from("client_media")
    .select("id, favorited_at")
    .eq("client_id", clientId)
    .eq("source", "client")
  return data ?? []
}

export async function getMediaOwner(
  db: Db,
  mediaId: string,
): Promise<string | null> {
  const { data } = await db
    .from("client_media")
    .select("client_id")
    .eq("id", mediaId)
    .maybeSingle()
  return data?.client_id ?? null
}

export async function getMediaStorageKey(
  db: Db,
  mediaId: string,
): Promise<string | null> {
  const { data } = await db
    .from("client_media")
    .select("storage_key")
    .eq("id", mediaId)
    .maybeSingle()
  return data?.storage_key ?? null
}

export async function getMediaFile(
  db: Db,
  mediaId: string,
): Promise<Pick<Row<"client_media">, "storage_key" | "kind"> | null> {
  const { data } = await db
    .from("client_media")
    .select("storage_key, kind")
    .eq("id", mediaId)
    .maybeSingle()
  return data ?? null
}

export type MediaInsert = {
  client_id: string
  source: string
  kind: string
  storage_key: string
  url: string
  service_id?: string | null
  booking_id?: string | null
  caption?: string | null
}

export async function insertMedia(
  db: Db,
  values: MediaInsert,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("client_media").insert(values)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Soft delete — the row survives so consent history stays auditable. */
export async function archiveMedia(
  db: Db,
  mediaId: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("client_media")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", mediaId)
  return { ok: !error }
}

/** Hard delete — erasure only, once the storage artifacts are gone. */
export async function deleteMedia(
  db: Db,
  mediaId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("client_media").delete().eq("id", mediaId)
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function setMediaFavorited(
  db: Db,
  mediaId: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("client_media")
    .update({ favorited_at: at })
    .eq("id", mediaId)
  return { ok: !error }
}

export async function setMediaDismissed(
  db: Db,
  mediaId: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("client_media")
    .update({ dismissed_at: at })
    .eq("id", mediaId)
  return { ok: !error }
}
