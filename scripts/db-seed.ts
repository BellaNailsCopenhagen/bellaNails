#!/usr/bin/env node
/**
 * `scripts/db-seed.ts` — insert realistic mock data for local testing and
 * demoing the app to freelance clients.
 *
 * Dev-only: never run against the live project. Creates categories, services,
 * addons, clients, bookings (mixed statuses), client media, media releases,
 * gallery placements, terms, feature flags, and schedule rules.
 *
 * Run with:
 *   node --import ./scripts/register-ts-paths.mjs scripts/db-seed.ts
 */

import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

const now = () => new Date().toISOString()
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

async function main() {
  const supabase = createSupabaseServiceRoleClient()
  const log = (table: string, n: number) => console.log(`  ✓ ${table}: ${n} row(s)`)

  // ── 1. Categories (no parents) ──────────────────────────────────────
  const cat1 = (await supabase.from("categories").insert({
    name_en: "Manicure",
    name_dk: "Manicure",
    description_en: "Hand care & gel",
    description_dk: "Håndpleje & gel",
    sort_order: 1,
  }).select("id").single()).data!
  const cat2 = (await supabase.from("categories").insert({
    name_en: "Pedicure",
    name_dk: "Pedicure",
    description_en: "Foot care & gel",
    description_dk: "Fodpleje & gel",
    sort_order: 2,
  }).select("id").single()).data!
  log("categories", 2)

  // ── 2. Services ─────────────────────────────────────────────────────
  const svc1 = (await supabase.from("services").insert({
    category_id: cat1.id,
    name_en: "Classic Gel Extension",
    name_dk: "Klassisk Gelforlængelse",
    description_en: "Long-wear, mirror-finish gel.",
    description_dk: "Langtidsholdbar gel med spejlfinish.",
    base_price_cents: 65000,
    base_duration_mins: 90,
    is_featured: true,
  }).select("id").single()).data!
  const svc2 = (await supabase.from("services").insert({
    category_id: cat1.id,
    name_en: "Gel Fill-In",
    name_dk: "Gel Opfyldning",
    description_en: "Maintenance fill for existing gel extensions.",
    description_dk: "Vedligeholdelse af eksisterende gelforlængelse.",
    base_price_cents: 45000,
    base_duration_mins: 60,
    is_featured: false,
  }).select("id").single()).data!
  const svc3 = (await supabase.from("services").insert({
    category_id: cat2.id,
    name_en: "Spa Pedicure",
    name_dk: "Spa Pedicure",
    description_en: "Relaxing foot treatment with gel polish.",
    description_dk: "Afslappende fodbehandling med gel lak.",
    base_price_cents: 55000,
    base_duration_mins: 75,
    is_featured: false,
  }).select("id").single()).data!
  log("services", 3)

  // ── 3. Add-ons ──────────────────────────────────────────────────────
  await supabase.from("addons").insert([
    { service_id: svc1.id, name_en: "French tips", name_dk: "French tips", extra_price_cents: 5000, extra_duration_mins: 15 },
    { service_id: svc1.id, name_en: "Nail art charm", name_dk: "Neglekunst charm", extra_price_cents: 8000, extra_duration_mins: 20 },
    { service_id: svc3.id, name_en: "Foot mask", name_dk: "Fodmaske", extra_price_cents: 6000, extra_duration_mins: 15 },
  ])
  log("addons", 3)

  // ── 4. Booking settings ─────────────────────────────────────────────
  await supabase.from("booking_settings").upsert({
    id: true,
    slot_interval_mins: 30,
    buffer_mins: 15,
    min_lead_mins: 120,
    max_advance_days: 60,
  })
  log("booking_settings", 1)

  // ── 5. Schedule rules ───────────────────────────────────────────────
  await supabase.from("schedule_rules").insert([
    { kind: "weekly", weekday: 1, start_time: "09:00", end_time: "18:00", label: "Monday" },
    { kind: "weekly", weekday: 2, start_time: "09:00", end_time: "18:00", label: "Tuesday" },
    { kind: "weekly", weekday: 3, start_time: "09:00", end_time: "18:00", label: "Wednesday" },
    { kind: "weekly", weekday: 4, start_time: "09:00", end_time: "18:00", label: "Thursday" },
    { kind: "weekly", weekday: 5, start_time: "09:00", end_time: "17:00", label: "Friday" },
    { kind: "weekly", weekday: 6, start_time: "09:00", end_time: "15:00", label: "Saturday" },
  ])
  log("schedule_rules", 6)

  // ── 6. Clients ──────────────────────────────────────────────────────
  const clientEmails = ["anna@example.dk", "lars@example.dk", "sofie@example.dk", "mikkel@example.dk", "freja@example.dk"]
  const clientNames = ["Anna Jensen", "Lars Møller", "Sofie Hansen", "Mikkel Petersen", "Freja Nielsen"]
  const clientPhones = ["+45 20 30 40 50", "+45 21 31 41 51", "+45 22 32 42 52", "+45 23 33 43 53", "+45 24 34 44 54"]
  const clients = await Promise.all(clientEmails.map(async (email, i) => {
    const { data } = await supabase.from("clients").insert({
      email,
      name: clientNames[i],
      phone: clientPhones[i],
      communication_locale: i < 3 ? "da" : "en",
    }).select("id").single()
    return data!
  }))
  log("clients", clients.length)

  // ── 7. Bookings (mixed statuses) ────────────────────────────────────
  const statuses = ["confirmed", "completed", "cancelled", "completed", "confirmed", "requested"]
  const services = [svc1, svc2, svc3]
  const bookings = await Promise.all(clients.map(async (client, i) => {
    const [dur, price] = [[90, 65000], [60, 45000], [75, 55000]][i % 3]
    const start = days(i - 10)
    const end = new Date(Date.parse(start) + dur * 60000).toISOString()
    const { data } = await supabase.from("bookings").insert({
      client_id: client.id,
      start_time: start,
      end_time: end,
      status: statuses[i % statuses.length],
      total_price_cents: price,
    }).select("id").single()
    return data!
  }))
  log("bookings", bookings.length)

  // ── 8. Client media ─────────────────────────────────────────────────
  await supabase.from("client_media").insert(bookings.map((b, i) => ({
    client_id: clients[i % clients.length].id,
    booking_id: b.id,
    service_id: services[i % 3].id,
    storage_key: `private/booking_${b.id}_${i}.jpg`,
    url: `https://example.supabase.co/storage/v1/object/public/media-private/private/booking_${b.id}_${i}.jpg`,
    kind: "image",
    source: "studio",
    is_feature: i === 0,
    in_gallery: i < 3,
  })))
  log("client_media", bookings.length)

  // ── 9. Media releases (consent lifecycle) ──────────────────────────
  await supabase.from("media_releases").insert([
    { booking_id: bookings[0].id, client_id: clients[0].id, purpose: "website", status: "granted", consent_version: "2026-08-v1", requested_at: now(), granted_at: now() },
    { booking_id: bookings[0].id, client_id: clients[0].id, purpose: "social", status: "withdrawn", consent_version: "2026-08-v1", requested_at: now(), granted_at: days(-5), withdrawn_at: days(-2) },
    { booking_id: bookings[1].id, client_id: clients[1].id, purpose: "website", status: "declined", consent_version: "2026-08-v1", requested_at: now(), declined_at: days(-1) },
    { booking_id: bookings[2].id, client_id: clients[2].id, purpose: "social", status: "requested", consent_version: "2026-08-v1", requested_at: now() },
    { booking_id: bookings[3].id, client_id: clients[3].id, purpose: "education", status: "granted", consent_version: "2026-08-v1", requested_at: now(), granted_at: days(-3) },
  ])
  log("media_releases", 5)

  // ── 10. Assets (published copies) ───────────────────────────────────
  await supabase.from("assets").insert([
    { url: "https://example.supabase.co/storage/v1/object/public/media-public/public/hero_01.jpg", media_type: "image", purpose: "website", storage_key: "public/hero_01.jpg", storage_provider: "supabase" },
    { url: "https://example.supabase.co/storage/v1/object/public/media-public/public/gallery_01.jpg", media_type: "image", purpose: "website", storage_key: "public/gallery_01.jpg", storage_provider: "supabase" },
  ])
  log("assets", 2)

  // ── 11. Gallery items ──────────────────────────────────────────────
  await supabase.from("gallery_items").insert([
    { primary_asset_id: null, display_mode: "single", title_en: "Studio detail", title_dk: "Studiedetalje", sort_order: 1 },
    { primary_asset_id: null, display_mode: "single", title_en: "Mirror shine", title_dk: "Spejlglans", sort_order: 2 },
    { primary_asset_id: null, display_mode: "single", title_en: "Signature set", title_dk: "Signatursæt", sort_order: 3 },
  ])
  log("gallery_items", 3)

  // ── 12. Terms ──────────────────────────────────────────────────────
  await supabase.from("terms").insert([
    { kind: "service", version: 1, title_en: "Service Terms", title_dk: "Servicebetingelser", body_en: "By booking you agree to our service terms.", body_dk: "Ved booking accepterer du vores servicebetingelser.", is_current: true },
    { kind: "data", version: 1, title_en: "Data Use Terms", title_dk: "Databetingelser", body_en: "We use your data to manage appointments.", body_dk: "Vi bruger dine data til at administrere aftaler.", is_current: true },
  ])
  log("terms", 2)

  // ── 13. Feature flags ──────────────────────────────────────────────
  await supabase.from("feature_flags").insert([
    { key: "booking", enabled: true },
    { key: "appointments", enabled: true },
    { key: "outsideHoursRequests", enabled: false },
  ])
  log("feature_flags", 3)

  console.log("")
  console.log("✓ Mock data seeded. You now have:")
  console.log(`  • ${clients.length} clients`)
  console.log(`  • ${bookings.length} bookings (mixed statuses)`)
  console.log("  • 3 services + add-ons across 2 categories")
  console.log("  • Media releases in granted / withdrawn / declined / requested states")
  console.log("")
  console.log("Clean up later with: pnpm dlx tsx scripts/db-clean.ts --confirm")
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err)
  process.exit(1)
})