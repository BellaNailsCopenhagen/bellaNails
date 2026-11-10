#!/usr/bin/env node
/**
 * `scripts/db-clean.ts` — delete every row from every public table, in
 * foreign-key-safe order (children before parents). Irreversible.
 *
 * Requires `--confirm`. Dev-only: never run against the live project.
 * Run with:
 *   node --import ./scripts/register-ts-paths.mjs scripts/db-clean.ts --confirm
 */

import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import type { Database } from "@/platform/supabase/types"

type TableName = keyof Database["public"]["Tables"]

// Child tables first, then parents, so FK constraints never block a delete.
const TABLES = [
  // join / linking tables
  "addon_incompatibilities",
  "asset_usages",
  "booking_requests",
  "client_consents",
  "communications",
  "design_messages",
  "design_refs",
  "gallery_items",
  "media_releases",
  "owner_notifications",
  "price_history",
  "service_addons",
  "service_sections",
  "terms_acceptances",
  // data rows
  "assets",
  "bookings",
  "client_media",
  "design_requests",
  "offers",
  "addons",
  "services",
  "categories",
  "clients",
  "terms",
  "testimonials",
  // standalone config
  "feature_flags",
  "insights_months",
  "rate_limits",
  "schedule_rules",
  "booking_protection",
]

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Usage: pnpm dlx tsx scripts/db-clean.ts --confirm")
    console.error("")
    console.error("This deletes ALL data from every public table. Irreversible.")
    process.exit(1)
  }

  const supabase = createSupabaseServiceRoleClient()
  let total = 0

  for (const table of TABLES) {
    try {
      const result = await supabase.from(table as TableName).delete()
      const { error, count } = result
      if (error) {
        console.error(`  ✗ ${table}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      total += count ?? 0
      console.log(`  ✓ ${table}: cleared`)
    } catch (err) {
      console.error(`  ✗ ${table}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log("")
  console.log(`✓ Cleared ${total} rows across ${TABLES.length} tables.`)
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err)
  process.exit(1)
})
