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
- ✅ Verified tokens + fonts: every component token class resolves in `@theme`; brand hexes + self-hosted Cormorant/Jakarta `.woff2` confirmed in compiled output. Added missing `--destructive` (muted `#8e2c2c`) that the destructive variant + all `aria-invalid` states reference.
- ⬜ Remaining brand primitives: `Container`/`Section` shells, `SiteHeader` + `SiteFooter`, `LanguageToggle`.
- ✅ `/styleguide` now sectioned (Typography · Buttons · Prices); extend as components land.

## Phase 2 — i18n + route structure ✅

Goal: `/da` (default) + `/en`, server-rendered, no flicker. ⚠️ Next 16 uses `proxy.ts`, not `middleware.ts`.

- ✅ Installed `next-intl@4.13` (peer-deps list `next ^16.0.0`). `next.config.ts` wrapped with `createNextIntlPlugin('./src/i18n/request.ts')`.
- ✅ Routes restructured under `src/app/[locale]/` (`layout.tsx` is now the root layout with `<html lang={locale}>`; `page.tsx` + `styleguide/` moved). Old root `layout.tsx`/`page.tsx` removed; `globals.css` stays at `src/app/`.
- ✅ `src/proxy.ts` re-exports next-intl's middleware as `proxy` (Node runtime per Next 16) with a matcher excluding `api`/`_next`/assets. `/` → `/da`; unknown paths (`/fr`) prefix to `/da/fr` → 404.
- ✅ `src/i18n/` config: `routing.ts` (locales `['da','en']`, default `da`, `localePrefix: 'always'`), `navigation.ts` (locale-aware `Link`/`redirect`/etc.), `request.ts`. `messages/da.json` + `messages/en.json` with short keys; typed via `src/global.d.ts` (`AppConfig` augmentation) so keys are checked at build.
- ✅ `[locale]/layout.tsx` wraps children in `NextIntlClientProvider`, sets `<html lang={locale}>`, validates locale (`hasLocale` → `notFound`), `setRequestLocale` for static rendering, `generateStaticParams` (both locales prerender SSG), locale-aware `generateMetadata`.
- ✅ `LocaleToggle` (`src/components/locale-toggle.tsx`) using next-intl navigation `Link` + `locale` prop — pure-link switch, works without JS. Verified: `params` awaited, SSR ships localized copy + `<html lang>` (no client flash), `/da` Danish + `/en` English confirmed via prod server.

> Note: this also delivers the `LanguageToggle` left open in Phase 1's "remaining brand primitives". `Container`/`Section` shells + `SiteHeader`/`SiteFooter` are still outstanding from Phase 1.

## Phase 3 — Data layer & Supabase schema ✅

- ✅ Schema applied directly in Supabase (owner). Tables: `categories`, `services`, `addons`, `addon_incompatibilities`, `assets`, `gallery_items`, `bookings`. ⚠️ Localized columns use the **`_dk`** suffix (not `_da`) for Danish + `_en` for English — the `da` locale maps to `_dk`.
- ✅ `@supabase/supabase-js` clients in `src/lib/supabase/`: `client.ts` (browser singleton, anon), `server.ts` (RSC/route-handler anon client **+** `server-only` service-role client that bypasses RLS), shared `env.ts` guard. Clerk-token `accessToken` wiring is marked as a Phase 4 TODO in each.
- ✅ TS types in `src/lib/supabase/types.ts` — **generated from the live schema via the Supabase MCP** (`Database` + full generics + `Constants`). Regenerate with `supabase gen types typescript --project-id <ref>`.
- ✅ **RLS applied + verified via MCP** ([supabase/rls.sql](../supabase/rls.sql)): all tables had RLS enabled but **zero policies** (catalog was unreadable by anon). Added public `select` for active catalog (`to anon, authenticated`); verified anon sees services/categories/gallery and **cannot** see `bookings`. Also hardened a pre-existing `rls_auto_enable()` `SECURITY DEFINER` function the advisors flagged (revoked `execute` from PUBLIC).
- ✅ **Realtime applied** ([supabase/realtime.sql](../supabase/realtime.sql)): `bookings` added to `supabase_realtime` (verified).
- ✅ Seed **not needed** — the project already contains sample rows; [supabase/seed.sql](../supabase/seed.sql) kept for fresh/dev DBs only.
- ⬜ Indices — deferred; confirm which query paths need them once Phase 7 read patterns exist.
- ⬜ `bookings` RLS (owner-reads-all + user-reads-own keyed off Clerk `sub`) → Phase 4. Advisors correctly still flag `bookings` as RLS-enabled-no-policy (intentional deny-all until then).

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
- ⬜ "The Formula" section — powered by Didier Lab (HEMA-free · vegan · cruelty-free · fiberglass-reinforced · Vitamin E + calcium); durability + "difficult nails" positioning. Story framing: **personal, first-person, no medical diagnosis** (chosen). Placement TBD (dedicated band vs upgrade "Premium Formulas"). Copy drafted; see also Phase 10 keywords.
- ⬜ Services menu (from `services` + `addons`, localized, prices formatted).
- ⬜ Gallery (`gallery_items`: portfolio + before/after; Cloudinary `q_auto,f_auto`).
- ⬜ "My bookings" (authed) — reschedule/cancel via stored Cal.com URLs.

## Phase 8 — Admin

- ⬜ Owner-gated `/[locale]/admin` shell.
- ⬜ Manage services / add-ons / incompatibilities (soft-delete via `archived_at`).
- ⬜ Manage gallery — Cloudinary signed client upload, store URL only, drag-sort `sort_order`.
- ⬜ Booking queue (client component + Query + Realtime).

## Phase 9 — Hardening & launch

- ⬜ SEO/metadata per locale, sitemap, OG images. → see Phase 10 (Local SEO).
- ⬜ Error/loading boundaries, empty states, toasts.
- ⬜ Lighthouse / a11y pass; verify no booking-UI flicker.
- ⬜ Env wiring on host (Vercel free tier), webhook URLs pointed at prod, secrets set.
- ⬜ Smoke test full booking → webhook → DB → admin live update.

## Phase 10 — Local SEO (Ørestad / Bella Kvarter)

Goal: own **"neglesalon Ørestad"** + **"neglesalon Bella Kvarter"** and win the local pack.
Full strategy, keyword map, copy and schema snippets in [seo-plan.md](./seo-plan.md).

**On-page** (lands with Phases 7 & 9):

- ⬜ "Bella Nails" text wordmark replacing the placeholder logo.
- ⬜ Per-locale `<title>`/description (da/en): neglesalon + Ørestad + services.
- ⬜ Keyworded `<h1>` + small "Neglesalon i Ørestad · København" hero kicker (poetic line kept).
- ⬜ Danish service names via `messages` (Geleforlængelse, Klassisk Manicure, Shellac / BIAB).
- ⬜ Crawlable footer NAP + areas served (Ørestad · Bella Kvarter · Amager · Islands Brygge · Kastrup).
- ⬜ Descriptive image `alt` on all gallery media.
- ⬜ FAQ section (long-tail) + `FAQPage` schema.
- ⬜ `NailSalon`/`LocalBusiness` JSON-LD (NAP, geo, openingHours, areaServed, sameAs).
- ⬜ hreflang `da`/`en` + `x-default`, self-referencing canonical; sitemap w/ hreflang + robots.txt.
- ⬜ Hero image perf (Cloudinary `f_auto,q_auto`, `next/image` `priority`) — Core Web Vitals.

**Off-page** (parallel — highest leverage):

- ⬜ Google Business Profile: claim, primary category "Nail salon", exact NAP, photos, services+prices, Cal.com link, regular posts.
- ⬜ Review engine: QR at checkout + post-visit SMS/email via Cal.com; respond to ≥80%.
- ⬜ Citations w/ consistent NAP: Krak, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places, Booksy.
- ⬜ Danish blog (1/mo) targeting long-tail → internal links to booking.
- ⬜ Local backlinks (Ørestad / Bella Center / Amager groups) + Instagram geotags & hashtags.

⚠️ Blocked on: public phone, final domain, geo coordinates, social URLs (for NAP + schema).
Measure: Search Console (Tier-1 query positions), GBP insights, local-pack rank for "neglesalon Ørestad".

---

## Critical-path dependencies

```
Design system ─▶ i18n/routes ─▶ Supabase schema ─▶ Auth ─▶ Query+Realtime ─┐
                                                                            ▼
                                              Booking (Cal.com+Stripe) ─▶ Public + Admin features
```

Auth must land before RLS-protected Realtime is meaningful; schema before any data feature;
i18n route structure before features so pages are born localized.
