#!/usr/bin/env node
/**
 * `scripts/db-setup.ts` — verify the environment can reach Supabase and print
 * the exact next steps to bootstrap a fresh database.
 *
 * Dev-only: never run against the live project. It only reads; it never writes
 * DDL or data. Run with:
 *   node --import ./scripts/register-ts-paths.mjs scripts/db-setup.ts
 */

import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

async function main() {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    console.error("✗ Missing env vars:", missing.join(", "))
    console.error("  Copy .env.example to .env.local and fill in the Supabase values.")
    process.exit(1)
  }

  const supabase = createSupabaseServiceRoleClient()

  // Prove we can reach the DB (service role bypasses RLS).
  const { error } = await supabase.from("services").select("count", {
    head: true,
  })
  if (error) {
    console.error("✗ Supabase connection failed:", error.message)
    console.error("  Have you applied supabase/schema.sql to your project?")
    process.exit(1)
  }

  console.log("✓ Supabase connection OK (service role)")
  console.log("")
  console.log("Next steps to bootstrap a fresh database:")
  console.log("")
  console.log("  1. Apply the schema (run once, on an empty database):")
  console.log("     psql \"$DATABASE_URL\" -f supabase/schema.sql")
  console.log("")
  console.log("  2. Create the three storage buckets:")
  console.log("     psql \"$DATABASE_URL\" -f supabase/storage-buckets.sql")
  console.log("")
  console.log("  3. (Dev only) Seed mock data:")
  console.log("     pnpm dlx tsx scripts/db-seed.ts")
  console.log("")
  console.log("  4. (Dev only) Clean everything and start over:")
  console.log("     pnpm dlx tsx scripts/db-clean.ts --confirm")
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err)
  process.exit(1)
})
