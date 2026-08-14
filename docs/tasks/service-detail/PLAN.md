# Service detail pages, sections, addon UX, price history

Autonomous multi-phase build. Each phase: `tsc`+`eslint`+`build` → review → commit → deploy. Migrations are applied by the owner (present) as we go.

## Vision (owner-confirmed)
- Keep the current **services menu** as-is; add a **"Learn more"** inline link per service → a **new per-service page** `/services/[slug]`.
- Detail page shows:
  - Service **sections** — ordered image + text blocks (studio-authored).
  - A **gallery split in two, clearly marked**: *"By the studio"* (studio-owned images) and *"What clients say"* (consented client photos **+ reviews**).
  - A **floating Book button** that appears on scroll → books this service.
- Section / feature images come from **consented public client photos** (the shared gallery we built) or a fresh upload.
- Public client photos are **consent-gated** and also reachable via **`/gallery?service=…`** (shareable deep link). Never show private/unconsented client media.

## Current state (grounding)
- `services`: single `image_url`, name_en/dk, description_en/dk, base_price_cents, base_duration_mins, cal_event_id/slug, category_id, is_featured. **No sections, no detail page** (one menu page at `src/app/[locale]/services/page.tsx`).
- `addons` (global/shared) + `service_addons` (link) + `addon_incompatibilities` (a,b pairs). `setAddonCompatibility(a,b,incompatible)` already exists.
- Images relate to a service only via bookings: `client_media.booking_id → booking.selected_addons.serviceId`.
- Consent/asset system already built: `media_consents`, `assets` (public copies), `asset_usages` (surfaces incl. `clients_gallery`, `testimonial`), `getPublicAssetsBySurface`.
- No price-history or reviews store.

## Decisions
- **Reviews** ("what clients say" text) has no store yet → ships in 2 steps: consented **photos** per service first, then a small **reviews** table (studio-entered text, optionally tied to a photo).
- **Name uniqueness**: server-side check (case-insensitive, active rows, exclude self) in create/update for services + addons — primary enforcement, works immediately. Optional DB unique-index migration as hardening (apply after clearing any existing dups).
- **Price history**: log a row whenever price changes (services base_price_cents, addons extra_price_cents); show newest-first in the edit dialog.
- **Detail page image source**: consented public client photos (`clients_gallery` surface) filtered to the service; studio section = studio-owned `assets`/uploads.

## Phases
1. **Name uniqueness** — server validation (services + addons) + optional unique-index migration.  ← in progress
2. **Price history** — `service_price_history` table + record-on-change + edit-dialog panel.
3. **Addon exclude-pairs in the addon edit dialog** — inline multi-select using setAddonCompatibility.
4. **Service sections** — `service_sections` table + image picker (upload / pick consented) + admin editing in the service dialog.
5. **Service detail page** — `/services/[slug]`, Learn-more link, sections, two-part gallery, floating Book CTA, `?service=` deep link (consent-gated).
6. **Reviews** — `reviews` table + admin entry + render in "What clients say".

## Migrations to apply (as we go)
- (phase 1) `supabase/name-uniqueness.sql` — optional hardening (after clearing dups).

## Test plan / changed files — filled per phase below.
