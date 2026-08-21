# Service detail pages, sections, addon UX, price history

> **File paths below predate the Aug 2026 restructure.** `src/lib/**` and
> `src/components/sections/` no longer exist; the layers are now `app/`, `modules/`,
> `db/`, `platform/`, `shared/`. This document is kept as a record of the work as it
> was done — for current locations see [architecture.md](../../architecture.md).

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

## Migrations to apply
- `supabase/name-uniqueness.sql` — optional hardening (after clearing dups).
- `supabase/price-history.sql` — required for price history.
- `supabase/service-sections.sql` — required for sections + detail page.
- `supabase/reviews.sql` — required for reviews.

## Status
- **P1–P3 SHIPPED + deployed** (`d54838c`, `d09cfbf`). **P4 checkpoint** (`8f02f2c`). **P5+P6 built, reviewed, committing.**
- Route: detail page is `/services/[id]` (service id, not a slug) — stable + reachable via the "Learn more" link; the page URL itself is the shareable per-service gallery (no separate `/gallery?service=` needed).
- Detail page "By the studio" / "What clients say" = consented **site**-purpose photos for the service, split by originating source (owner vs client). Reviews are studio-entered text.

## Known follow-ups (non-blocking)
- `publishStudioImage` can orphan a public asset if the section save is then cancelled (harmless studio image; no cleanup path yet).
- `moveSection` swap is two non-transactional updates (error-checked; a mid-failure self-heals on the next swap).
- Reviews are studio-entered; a client-facing review submission flow could come later.

## Changed files (P4–P6)
- Migrations: `supabase/{price-history,service-sections,reviews,name-uniqueness}.sql`.
- Reads/actions: `src/lib/{service-sections,reviews}.ts`, `src/lib/services/get-public-service.ts`, `src/lib/actions/{manage-service-sections,manage-reviews}.ts`, `src/lib/actions/manage-services.ts` (uniqueness + price history).
- Admin: `src/components/admin/{price-history-panel,image-picker,service-sections-manager,reviews-manager}.tsx`, `edit-service-sheet.tsx`, `edit-addon-sheet.tsx`, `addons-tab.tsx`, `src/app/admin/services/[id]/page.tsx`.
- Public: `src/app/[locale]/services/[id]/page.tsx`, `src/components/sections/{floating-book-button,service-row,service-menu}.tsx`, `src/config/routes.ts`, `messages/{en,da}.json`.
- `src/lib/supabase/types.ts` — price_history, service_sections, reviews.

## Test plan
1. Apply the 3 required migrations. `/admin/services/[id]` shows Sections, Price history, and Reviews (no more placeholders).
2. Add a section: pick a consented photo OR upload new; reorder up/down; edit; delete. Only **site**-consented photos appear in the picker.
3. Add/remove a review (name, 1–5 rating, text).
4. Public: services menu shows a **"Learn more"** link → `/services/[id]`. Detail page renders header + sections + "By the studio" + "What clients say" (reviews + client photos) + a floating **Book** CTA that appears on scroll and books that service. Never shows a private or social-only photo.
5. Price history shows in both the edit dialog and the admin service page after a price change.
6. Duplicate service/add-on names are rejected with a clear message.
