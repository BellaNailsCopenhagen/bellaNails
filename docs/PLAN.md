# Bella Nails — Build Plan

> Phased, dependency-ordered plan to take Bella Nails from scaffold to MVP.
> Honors the locked build order: **design system → i18n/routes → schema → integrations → features**.
> See [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) for the why, and [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for the how of each service.

Legend: ✅ done · 🔼 in progress · ⬜ todo

---

## Phase 0 — Scaffold & repo hygiene ✅

- ✅ Next 16 + React 19 + Tailwind v4 + shadcn `base-luma` scaffolded; pnpm via corepack.
- ✅ Brand tokens + fonts wired (`globals.css`, `layout.tsx`).
- ✅ Replaced default `page.tsx` boilerplate with on-brand placeholder; real root `metadata` (title template + `metadataBase`).
- ✅ Added `.env.example` (all keys, no secrets); `.gitignore` exempts it (`!.env.example`) so it commits while `.env.local` stays ignored.
- ✅ `pnpm lint` and `pnpm build` green (TypeScript passes; `/` prerenders static).
- ⬜ *(optional)* Remove leftover `public/next.svg`, `public/vercel.svg` from create-next-app — no longer referenced.

## Phase 1 — Design system primitives (FIRST) 🔼

Goal: an on-brand component kit so every later feature is consistent from day one.

- ✅ **Typography system** (`src/components/ui/typography.tsx`) — cva-based, derived from the landing comp: `Display`, `H1`, `H2`, `H3`, `Eyebrow`, `Lead`, `Body`, `BodySm`, `Quote`, `Caption`. Cormorant italic enabled in the font loader (roman+italic heading signature).
- ✅ `/styleguide` page (noindex) previewing the type scale against real landing copy.
- ✅ **Button** (`button.tsx`) — re-themed base-luma/base-ui: squared corners, uppercase + `tracking-ui-button`, `default` (Onyx) + `inverse` (light-on-dark hero) variants, sizes sm/default/lg.
- ✅ **PriceTag** (`price-tag.tsx`) — cents→amount, editorial face, `Intl.NumberFormat` (locale prop), `sign` for add-on deltas.
- ✅ **Form set** — `input`, `textarea`, `label`, `checkbox`, `separator` re-themed to the comp: underline-only inputs (`border-b`), uppercase muted `Label` (= `Caption`), squared Onyx `Checkbox`. Later: `card`, `dialog`, `sheet`, `dropdown-menu`, `badge`, `skeleton`, `sonner`, `tabs`, `select`, `avatar` as needed.
- ⬜ Verify each picks up Onyx/Alabaster tokens + Cormorant/Jakarta fonts (override variants where needed).
- ⬜ Remaining brand primitives: `Container`/`Section` shells, `SiteHeader` + `SiteFooter`, `LanguageToggle`.
- ✅ `/styleguide` now sectioned (Typography · Buttons · Prices); extend as components land.

## Phase 2 — i18n + route structure

Goal: `/da` (default) + `/en`, server-rendered, no flicker. ⚠️ Next 16 uses `proxy.ts`, not `middleware.ts`.

- ⬜ Install `next-intl`; confirm version compatible with Next 16 `proxy` convention.
- ⬜ Restructure routes under `src/app/[locale]/` (move `layout.tsx` + `page.tsx`).
- ⬜ `src/proxy.ts` exporting `proxy()` for locale negotiation/redirect (Danish default).
- ⬜ `src/i18n/` config (locales `['da','en']`, request config) + `messages/da.json`, `messages/en.json` with short keys (`services.gel.title`).
- ⬜ Wrap `[locale]/layout.tsx` with `NextIntlClientProvider`; set `<html lang={locale}>`.
- ⬜ Locale switcher component; verify SSR (no client flash) and that `params` is awaited.

## Phase 3 — Data layer & Supabase schema

- ⬜ Apply schema (services, addons, addon_incompatibilities, gallery_items, bookings) — DDL in [INFRASTRUCTURE.md](./INFRASTRUCTURE.md#supabase). Apply the `_da` rename.
- ⬜ Add indices + enable Realtime publication on `bookings` (and any other live table).
- ⬜ `@supabase/supabase-js` clients: browser client + server client (RSC/route handlers) in `src/lib/supabase/`.
- ⬜ Generate TS types from the DB (`supabase gen types`) into `src/lib/supabase/types.ts`.
- ⬜ Seed a few services/addons/gallery rows for development.
- ⬜ Write baseline RLS policies (public read of active services/gallery; owner-only writes).

## Phase 4 — Auth (Clerk + Supabase native)

- ⬜ Install `@clerk/nextjs`; add `ClerkProvider` (inside `[locale]/layout.tsx`).
- ⬜ Wire locale-aware sign-in/up routes; gate `/[locale]/admin` on metadata `{"role":"owner"}`.
- ⬜ Configure **Supabase native third-party auth** for Clerk (NOT the deprecated JWT template).
- ⬜ Write RLS against Clerk claims; pass the Clerk token to the Realtime client.
- ⬜ ⚠️ If using a Clerk **custom domain**, test authed Realtime early (JWKS `/.well-known/jwks.json` vs `/jwks` 404 bug).

## Phase 5 — TanStack Query + Realtime wiring

- ⬜ `QueryClientProvider` + `HydrationBoundary` in App Router (RSC prefetch → hydrate, no double-fetch).
- ⬜ Migrate booking-flow client data to `useQuery`.
- ⬜ One Realtime hook on `bookings` → `invalidateQueries`; verify two-browser live update.
- ⬜ (Later) shadcn data-table for the admin queue.

## Phase 6 — Booking flow (Cal.com + Stripe)

- ⬜ Install `@calcom/embed-react`; themed embed (`brandColor` Onyx, `bodyBg` Alabaster, matching fonts/radii), pass language.
- ⬜ Service/add-on selection UI → compute total (cents) + duration; handle `addon_incompatibilities`.
- ⬜ Redirect to own `/[locale]/confirmation` on success.
- ⬜ `/api/webhooks/cal` — validate signature, on `BOOKING_CREATED` upsert into `bookings`.
- ⬜ Stripe no-show card holds via Cal.com (SetupIntents) — config in Cal.com + Stripe dashboards.

## Phase 7 — Public site features

- ⬜ Home / hero (Quiet Luxury landing).
- ⬜ Services menu (from `services` + `addons`, localized, prices formatted).
- ⬜ Gallery (`gallery_items`: portfolio + before/after; Cloudinary `q_auto,f_auto`).
- ⬜ "My bookings" (authed) — reschedule/cancel via stored Cal.com URLs.

## Phase 8 — Admin

- ⬜ Owner-gated `/[locale]/admin` shell.
- ⬜ Manage services / add-ons / incompatibilities (soft-delete via `archived_at`).
- ⬜ Manage gallery — Cloudinary signed client upload, store URL only, drag-sort `sort_order`.
- ⬜ Booking queue (client component + Query + Realtime).

## Phase 9 — Hardening & launch

- ⬜ SEO/metadata per locale, sitemap, OG images.
- ⬜ Error/loading boundaries, empty states, toasts.
- ⬜ Lighthouse / a11y pass; verify no booking-UI flicker.
- ⬜ Env wiring on host (Vercel free tier), webhook URLs pointed at prod, secrets set.
- ⬜ Smoke test full booking → webhook → DB → admin live update.

---

## Critical-path dependencies

```
Design system ─▶ i18n/routes ─▶ Supabase schema ─▶ Auth ─▶ Query+Realtime ─┐
                                                                            ▼
                                              Booking (Cal.com+Stripe) ─▶ Public + Admin features
```

Auth must land before RLS-protected Realtime is meaningful; schema before any data feature;
i18n route structure before features so pages are born localized.
