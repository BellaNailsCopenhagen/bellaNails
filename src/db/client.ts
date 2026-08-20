import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/platform/supabase/types"

/**
 * The handle every `db/` function takes as its first argument. Data-layer
 * functions never build a client — the caller picks anon / session / service
 * role, and that choice IS the authorization decision.
 */
export type Db = SupabaseClient<Database>

/** Row shape of one table, as generated from the schema. */
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

/** Insert payload for one table, as generated from the schema. */
export type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

/** Update payload for one table, as generated from the schema. */
export type Update<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
