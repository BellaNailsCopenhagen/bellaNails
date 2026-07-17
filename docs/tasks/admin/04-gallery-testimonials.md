# Task 04 — Gallery & testimonials management

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01 and the
> applied [gallery-ordering.sql](../../../supabase/gallery-ordering.sql).

## Goal

The owner curates the visual site herself: gallery items (portfolio +
before/after) with Cloudinary uploads, the five home-page slots, and
testimonials — no developer in the loop for content.

## In scope

- **Gallery CRUD** (`gallery_items` + `assets`): upload via Cloudinary
  (`q_auto,f_auto`; unsigned preset or signed upload per `.env.example`),
  display modes (single / before-after pair), bilingual titles.
- **Home slots**: assign items to slots 1–5 (`sort_order`, DB-enforced
  unique + range) with a simple picker; the home StudioGallery and the
  /gallery page read the result. Replacing the placeholder /gallery page
  with the full curated grid closes the Phase 7 gallery item.
- **Testimonials**: new `testimonials` table per PLAN (quote as-given —
  single language allowed — author, role, `sort_order`, `is_published`,
  `archived_at`; public read RLS). Migrate the three i18n testimonials as
  seed rows; home section switches to the table.
- Mobile-first: uploading a photo from the phone camera roll must be the
  happy path.

## Acceptance criteria

- Phone flow: shoot → upload → set title → assign slot → home page shows it.
- Slot constraints enforced by the DB (second item into slot 3 fails
  gracefully in the UI).
- Testimonials render from the table; unpublished/archived never leak
  (verify as anon).
