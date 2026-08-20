import type { Db, Insert, Row, Update } from "./client"
import { flattenServiceAddons } from "./service-addons"

/**
 * `services` table access. Two column sets, because the public surfaces and
 * the admin surfaces genuinely want different things: the public reads never
 * see archived rows or Cal wiring, the admin read sees everything.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PUBLIC_COLUMNS =
  "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins"

/** Add-ons come through the service_addons join (many-to-many). */
const ADMIN_COLUMNS =
  "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins, cal_event_slug, category_id, archived_at, service_addons(addons(id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at))"

const BOOKABLE_COLUMNS =
  "id, name_en, name_dk, base_price_cents, base_duration_mins, cal_event_id, cal_event_slug, service_addons(addons(id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at))"

export type PublicServiceRow = Pick<
  Row<"services">,
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "base_price_cents"
  | "base_duration_mins"
>

export type AddonRow = Pick<
  Row<"addons">,
  | "id"
  | "name_en"
  | "name_dk"
  | "extra_price_cents"
  | "extra_duration_mins"
  | "archived_at"
>

export type AdminServiceRow = Pick<
  Row<"services">,
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "base_price_cents"
  | "base_duration_mins"
  | "cal_event_slug"
  | "category_id"
  | "archived_at"
> & { addons: AddonRow[] }

type RawAdminService = Omit<AdminServiceRow, "addons"> & {
  service_addons: { addons: AddonRow | null }[]
}

function flattenAdminService(raw: RawAdminService): AdminServiceRow {
  const { service_addons, ...rest } = raw
  return { ...rest, addons: flattenServiceAddons<AddonRow>(service_addons) }
}

// ---------------------------------------------------------------- reads

/** One active service by id, for its public detail page. */
export async function getPublicServiceRow(
  db: Db,
  id: string,
): Promise<PublicServiceRow | null> {
  const { data } = await db
    .from("services")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle()
  return data ?? null
}

/** The three featured services for the home page, in Cal-event order. */
export async function listFeaturedServiceRows(
  db: Db,
  limit: number,
): Promise<PublicServiceRow[]> {
  const { data, error } = await db
    .from("services")
    .select(PUBLIC_COLUMNS)
    .eq("is_featured", true)
    .is("archived_at", null)
    .order("cal_event_id", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export type BookableServiceRow = Pick<
  Row<"services">,
  | "id"
  | "name_en"
  | "name_dk"
  | "base_price_cents"
  | "base_duration_mins"
  | "cal_event_id"
  | "cal_event_slug"
> & { service_addons: { addons: AddonRow | null }[] }

/** An active service plus its add-ons — the booking customizer's source. */
export async function getBookableService(
  db: Db,
  serviceId: string,
): Promise<BookableServiceRow | null> {
  const { data } = await db
    .from("services")
    .select(BOOKABLE_COLUMNS)
    .eq("id", serviceId)
    .is("archived_at", null)
    .maybeSingle()
  return (data as unknown as BookableServiceRow | null) ?? null
}

export type ServiceNames = Pick<
  Row<"services">,
  "name_en" | "name_dk" | "description_en" | "description_dk"
>

/** Names + descriptions for the as-booked product snapshot. */
export async function getServiceNames(
  db: Db,
  id: string,
): Promise<ServiceNames | null> {
  const { data } = await db
    .from("services")
    .select("name_en, name_dk, description_en, description_dk")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

export type ServiceNameEntry = {
  id: string
  name_en: string
  name_dk: string | null
  addons: { id: string; name_en: string; name_dk: string | null }[]
}

/** One query for every service+addon name a set of bookings needs. A
    missing entry means archived/unknown (RLS filters archived rows) —
    callers fall back to the generic session label. Non-uuid ids are dropped
    rather than sent to PostgREST. */
export async function getServiceNameCatalog(
  db: Db,
  serviceIds: (string | null | undefined)[],
): Promise<Map<string, ServiceNameEntry>> {
  const ids = [
    ...new Set(
      serviceIds.filter((id): id is string =>
        Boolean(id && UUID_PATTERN.test(id)),
      ),
    ),
  ]
  if (ids.length === 0) return new Map()

  const { data, error } = await db
    .from("services")
    .select("id, name_en, name_dk, service_addons(addons(id, name_en, name_dk))")
    .in("id", ids)
  if (error) throw new Error(error.message)

  type Raw = {
    id: string
    name_en: string
    name_dk: string | null
    service_addons: { addons: ServiceNameEntry["addons"][number] | null }[]
  }
  return new Map(
    ((data ?? []) as unknown as Raw[]).map((entry) => [
      entry.id,
      {
        id: entry.id,
        name_en: entry.name_en,
        name_dk: entry.name_dk,
        addons: flattenServiceAddons(entry.service_addons),
      },
    ]),
  )
}

/** Every service including archived, add-ons embedded — the admin catalog. */
export async function listAdminServices(db: Db): Promise<AdminServiceRow[]> {
  const { data, error } = await db
    .from("services")
    .select(ADMIN_COLUMNS)
    .order("name_en", { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as RawAdminService[]).map(flattenAdminService)
}

/** One service including archived, add-ons embedded — the admin detail page. */
export async function getAdminService(
  db: Db,
  id: string,
): Promise<AdminServiceRow | null> {
  const { data, error } = await db
    .from("services")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? flattenAdminService(data as unknown as RawAdminService) : null
}

export type ServiceCalWiring = Pick<
  Row<"services">,
  "cal_event_id" | "base_duration_mins"
>

/** The Cal event id + base duration — what a slot resync needs. */
export async function getServiceCalWiring(
  db: Db,
  id: string,
): Promise<ServiceCalWiring | null> {
  const { data } = await db
    .from("services")
    .select("cal_event_id, base_duration_mins")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

/** The Cal event id alone — the archive toggle hides/shows that event type. */
export async function getServiceCalEventId(
  db: Db,
  id: string,
): Promise<{ cal_event_id: number | null } | null> {
  const { data } = await db
    .from("services")
    .select("cal_event_id")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

/** Current duration + price, read before an update so the caller can tell
    what actually changed (duration → Cal resync, price → history entry). */
export async function getServicePricing(
  db: Db,
  id: string,
): Promise<Pick<Row<"services">, "base_duration_mins" | "base_price_cents"> | null> {
  const { data } = await db
    .from("services")
    .select("base_duration_mins, base_price_cents")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

export type CatalogName = { id: string; name_en: string; name_dk: string | null }

/** Active names in both languages — the uniqueness check compares in JS. */
export async function listActiveServiceNames(db: Db): Promise<CatalogName[]> {
  const { data } = await db
    .from("services")
    .select("id, name_en, name_dk")
    .is("archived_at", null)
  return data ?? []
}

// --------------------------------------------------------------- writes

export type ServiceInsert = Insert<"services">

export async function insertService(
  db: Db,
  values: ServiceInsert,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("services")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false, message: error?.message ?? "no row" }
  return { ok: true, id: data.id }
}

export type ServiceUpdate = Update<"services">

export async function updateService(
  db: Db,
  id: string,
  values: ServiceUpdate,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("services").update(values).eq("id", id)
  return { ok: !error }
}

/** Soft delete / restore. `at` is null to un-archive. */
export async function setServiceArchived(
  db: Db,
  id: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("services")
    .update({ archived_at: at })
    .eq("id", id)
  return { ok: !error }
}
