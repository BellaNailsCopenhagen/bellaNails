# Architecture Analysis — BellaNails

*Evidence-based assessment built from codebase inspection (July 2026). All references are grounded in file paths, imports, counts, and configuration that exist in the repository at the time of writing.*

---

| **locales** | `da` (Danish, default), `en` (English) |
| **localePolicy** | `always` — every path is prefixed (`/da`, `/en`); root `/` redirects to `/da` via the proxy.
| **Routing config** | `src/i18n/routing.ts`: `defineRouting({ locales: ["da", "en"], defaultLocale: "da", localePrefix: "always" })` |
| **Next-intl** | `next-intl` 4.13.0; plugin configured in `next.config.ts` (`createNextIntlPlugin("./src/i18n/request.ts")`). |
| **Static params** | `generateStaticParams()` in `src/app/[locale]/layout.tsx` returns all locales; `generateStaticParams()` in `src/app/admin/layout.tsx` returns only `{ locale: "en" }` (admin is English-only). |
| **Metadata** | Generated per-locale via `generateMetadata`; includes `title`, `description`, `openGraph`, `twitter`, `alternates` (canonical + hreflang + x-default). |
| **Robots** | `src/app/robots.ts`: disallows `/admin`, `/api`, `/da/approve`, `/en/approve`, `/da/manage`, `/en/manage`, `/da/offer`, `/en/offer`, `/da/testimonial`, `/en/testimonial` in production; allows `/` and home page. |
| **Sitemap** | `src/app/sitemap.ts`: both locales of every indexable route, with hreflang pairs and `priority` (home = 1, rest = 0.7). |
| **Disallowed paths** | `src/config/routes.ts`: `disallowedPaths` array (admin, api, signed links). |
| **Proxy** | `src/proxy.ts`: middleware that gates `/admin` to owner, guards protected client paths, refreshes Supabase session cookies, runs `next-intl` middleware for locale negotiation (`/` → `/da`). |
| **Admin routing** | Separate tree under `src/app/admin/`; English-only; NOT locale-prefixed; proxy-gated before any layout renders. |
## 1. System Overview

| Aspect | Detail |
|---|---|
| **Framework** | Next.js 16.2.12, App Router |
| **Package manager** | pnpm 11.9.0 |
| **Primary runtime** | Node 20+ |
| **Styling** | Tailwind CSS 4, class-variance-authority, clsx |
| **Icons** | lucide-react |
| **HTTP client** | None (Supabase PostgREST via generated clients) |
| **Formatting** | prettier |
| **Linting** | ESLint 9 with eight-layer boundary enforcement (see `eslint.config.mjs`) |
| **Test runner** | node with `--conditions=react-server`; 26 `.test.ts` / `.test.tsx` files |
| **Internationalisation** | `next-intl` 4.13.0; locales: `da`, `en`; `localePrefix: "always"`; default: `da` |
| **SEO / PWA** | Manifest route (`/manifest.webmanifest`), robots.txt, sitemap.xml, Open Graph, Twitter cards; icons generated via `/icons/[name]/route.tsx` |
| **Analytics** | **None detected**. No Plausible, PostHog, Vercel Analytics, or gtag. Noted as item 0 of the backlog in `docs/product-review.md`. |
| **Deployment** | `pnpm deploy:prod` → `scripts/deploy.sh`; domain `bellanails.dk` (pending `NEXT_PUBLIC_SITE_URL` update) |
| **Admin area** | Separate tree under `src/app/admin/`; English-only; not locale-prefixed; proxy-gated to owner only |

**High-level invariant**: The four-layer stack `app → modules → db → platform` is enforced by ESLint and must never be reversed. No layer may import from a layer below it, and `db/` may never import `modules/`, `components/`, `app/`, or `hooks/`.

## 8. Architectural Strengths

1. **Four-layer invariant** (`app → modules → db → platform`) is explicit and lint-enforced. No layer may skip or reverse, which prevents the most common architectural rot.
2. **Single source of truth for routes** — `src/config/routes.ts` is the canonical path registry; every internal `href` should be imported from here, never hardcoded.
3. **One file per table** in `db/` — column lists, soft-delete filters, and join shapes have exactly one definition. Schema changes are type errors (`Insert<"table">` / `Update<"table">` generated types).
4. **Authorization boundaries are clear**: modules own composition + auth; `db/` is purely data; platform knows the vendor; pages ask one question per concern.
5. **i18n is baked in at the middleware + layout level** — locale prefix, negotiation, and metadata are all handled in one place (`next-intl` + `proxy.ts` + `layout.tsx`).
6. **No vendor lock‑in beyond Supabase** — email is the only external adapter (Zoho SMTP), stored via Supabase Storage; everything else is internal.
7. **Error handling conventions** are codified: reads that can't render throw; reads that can degrade return empty; writes return `{ ok, message? }`.
8. **Module barrels are transitively server-only** — the ESLint rule and the build (Turbopack) both enforce that client components may not import a module barrel by value. Types-only import is fine.

| Risk | Evidence | Priority |
|---|---|---|
| **No analytics** | Confirmed absent in code and `docs/product-review.md:4`: "**no analytics in the app** (no Plausible/PostHog/Vercel Analytics — checked). Fixing that is item 0 of the backlog." | Critical — "flying blind" |
| **Clerk references are historical** | `docs/PLAN.md` references Clerk as "retired"; all current auth is Supabase. If a future phase re-introduces Clerk, the module barrel / auth boundary will need re-evaluation. | Medium |
| **`bookings` RLS is intentionally deny-all** (Phase 4 pending) | `docs/PLAN.md:103`: "⬜ `bookings` RLS (owner-reads-all + user-reads-own keyed off Clerk `sub`) → Phase 4." | High — booking flow depends on this |
| **Gallery ordering guardrails not yet applied** | `docs/PLAN.md:102`: "⬜ Gallery homepage ordering guardrails ... Apply to the live DB before the admin/gallery management flow is considered complete." | Medium |
| **Indices deferred** | `docs/PLAN.md:102`: "⬜ Indices — deferred; confirm which query paths need them once Phase 7 read patterns exist." | Low |
| **`NEXT_PUBLIC_SITE_URL` defaults to test domain** | `src/config/site.ts`: `process.env.NEXT_PUBLIC_SITE_URL ?? "https://bellanails.dk"`. Currently resolves to `https://test.bellanails.dk`; deploys as staging, crawlers blocked. Domain claim pending. | High — blocks search engine indexing |
| **`HUMAN_CHECK_SECRET` may be absent** | `src/instrumentation.ts`: warns if not set; the "I'm not a robot" check is never shown and bookings are never asked for a proof. | Medium |
| **`BOOKING_TOKEN_SECRET` falls back to service-role key** | `docs/tasks/TODO.md`: "Give `BOOKING_TOKEN_SECRET` its own value ... It falls back to the service-role key, so every emailed manage / approve / offer / testimonial link is signed with it. Rotating that key would kill all of them at once." | Medium |
| **Scaleway env var present but unused** | `src/config/site.ts` / `TODO.md`: `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` "read by nothing — storage is Supabase Storage". | Low |
| **Admin area has no locale prefix** | `src/app/admin/layout.tsx` is English-only; the proxy handles `/admin` gating. If a future need arises for multilingual admin, the layout will need rearchitecting. | Low |
| **Test coverage is sparse** | 26 test files for a codebase of this size; no e2e suite; critical flows (booking → admin queue → confirmation) not fully covered. | High (process risk) |
## 6. Testing

| Metric | Value |
|---|---|
| **Test files** | 26 files (mix of module tests, shared‑logic tests, notification-email tests) |
| **Test command** | `pnpm test` → `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/register-ts-paths.mjs --test "src/**/*.test.ts"` |
| **Coverage** | Not configured in `package.json`; no `--coverage` flag in the test script. |
| **Test distribution** | - `src/modules/design/offer-token.test.ts`<br>- `src/modules/notifications/email-layout.test.ts`<br>- `src/modules/testimonials/token.test.ts`<br>- `src/modules/server-actions.test.ts`<br>- `src/shared/` (18 files tested)<br>- `src/app/[locale]/confirmation/_components/confirmation-recap.tsx` (uses `useQuery`)<br>- `src/hooks/use-current-user.ts` (unit‑style) |
| **Test pattern** | Mostly unit / integration of pure functions and view models. End-to-end flows (booking from client → admin queue) are not yet covered. |
| **Key test observations** | - `confirmation-recap.tsx` is a client component that uses `useQuery` from TanStack Query to fetch the booking recap.<br>- `next-appointment.tsx` similarly uses `useQuery` keyed by `clientId` + `locale`.<br>- `requests-banner.tsx` uses `useQuery` for pending-requests and unread-design-replies counts.<br>- No Cypress / Playwright e2e suite detected. |
## 5. SEO / PWA Behavior

| Aspect | Detail |
|---|---|
| **Manifest** | Served as route handler `src/app/manifest.webmanifest/route.ts` (dynamic = "force-static"). Linked **only** from the admin layout metadata; the client site never advertises the studio app. |
| **Icons** | Generated PNGs via `src/app/icons/[name]/route.tsx` (three sizes: 192, 512, maskable-512). URL paths contain `.png` so they stay outside the i18n proxy matcher (which skips paths with a dot). |
| **Robots.txt** | `src/app/robots.ts`: production allows `/`, disallows admin/api/signed links; staging disallows `/`. |
| **Sitemap.xml** | `src/app/sitemap.ts`: both locales of indexable routes (`home`, `services`, `gallery`, `hours`, `terms`, `privacy`) with hreflang pairs and `x-default` = Danish. |
| **Open Graph / Twitter cards** | Generated per-locale in `src/app/[locale]/layout.tsx`; OG image auto-wired by Next from `/locale/opengraph-image.tsx`. |
| **Schema.org `NailSalon`** | `src/shared/local-business.ts` builds `LocalBusinessSchema` from `business_profile` + `schedule_rules`. Fields: `name`, `url`, `priceRange`, `address` (if available), `email`, `areaServed`, `sameAs` (social), `sameAsSpecification`. Notably omits `telephone` and `geo` (deliberate — open items in SEO plan). |
| **PWA** | Installable admin PWA (manifest + apple-touch icon from `src/app/admin/apple-icon.tsx`). Client site stays browser-only; the manifest is admin-scoped. |
| **Analytics** | **None** (confirmed gap; item 0 of backlog). |
## 4. Database / Platform Integrations

### 4.1 Supabase

- **Project URL**: `NEXT_PUBLIC_SUPABASE_URL` (env-asserted).
- **Anon key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (env-asserted).
- **Service-role key**: `SUPABASE_SERVICE_ROLE_KEY` (secret; used in module actions and API routes that bypass RLS).
- **Clients**:
  - `src/platform/supabase/client.ts` — browser singleton, anon auth. Used by browser components and `db/` functions called from the client.
  - `src/platform/supabase/server.ts` — two modes:
    - ** anon server client**: `persistSession: false, autoRefreshToken: false`; for public content where RLS `to anon` policies apply.
    - ** authed server client**: built via `createSupabaseSessionServerClient()` (cookie-based); RLS sees `auth.uid()` / `app_metadata`.
    - ** service-role client**: `createSupabaseServiceRoleClient()`; **bypasses RLS**; used for trusted mutations (guest booking, owner writes).
  - `src/platform/supabase/ssr-browser.ts` — browser client with session refresh (used by `use-current-user` hook).
- **RLS**: Applied and verified via `supabase/rls.sql`. Key decisions:
  - Tables `categories`, `services`, `addons`, `addon_incompatibilities`, `assets`, `gallery_items`, `bookings` have RLS enabled.
  - **Zero policies** initially; public `select` for active catalog (`to anon, authenticated`); anon sees services/categories/gallery and **cannot** see `bookings`.
  - `rls_auto_enable()` `SECURITY DEFINER` function hardened (revoked `execute` from `PUBLIC`).
  - `bookings` RLS: intentional deny-all until Phase 4; owner-reads-all + user-reads-own keyed off Clerk `sub` (future).
- **Types**: generated via `supabase gen types typescript --project-id <ref>` → `src/platform/supabase/types.ts`. Full generics + `Constants`. Regenerate after schema changes.

### 4.2 Supabase Storage

- Public bucket: `media-public/**` (configured in `next.config.ts` remotePatterns).
- Browser-side signed URLs for private objects.
- Admin writes via service-role client.

### 4.3 Zoho SMTP (email)

- Single file: `src/platform/email/client.ts`.
- Config reads `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS`, `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`.
- Absent credentials → logged warning, returns `{ ok: false, skipped: true }` (booking never fails on a missing key).
- Message shape: `EmailMessage` (`from`, `to`, `subject`, `html`, `text`, optional `replyTo`, optional `calendar`/iCal).
- Result shape: `EmailResult` (`ok`, optional `skipped`, optional `error` — error is a non-PII code/name).

### 4.4 No other vendor integrations

- No Plausible/PostHog/Vercel Analytics.
- No Clerk (historical references in `docs/PLAN.md` only — all "retired"). Current auth is Supabase Auth + RLS.
- No Cal.com (retired, replaced by in-house booking).
- No Scaleway (retired, replaced by Supabase Storage).
## 3. Request / Data Flow

### 3.1 Public page request (e.g. `/en/services`)

1. **Proxy** (`src/proxy.ts`) runs first: refreshes Supabase session cookies, guards protected paths (`/((da|en)/appointments/...)`), carries refreshed cookies through.
2. **Locale layout** (`src/app/[locale]/layout.tsx`) renders:
   - `QueryProvider` → `NextIntlClientProvider` → `SiteHeader` → `{children}` → `SiteFooter` → `Toaster`.
   - Metadata is generated per-locale (`generateMetadata`); Open Graph/Twitter cards wired in.
3. **Page component** renders. It may:
   - Call a module read (e.g. `getMyBookings` from `@/modules/booking/reads`) — this goes through `db/` with the **browser** Supabase client; RLS scopes rows to the authenticated user.
   - Use `useQuery` from `@tanstack/react-query` (TanStack Query provider is mounted app-wide).
   - Render UI from `src/components/` or co-located `_components/`.

### 3.2 Admin page request (e.g. `/admin/appointments`)

1. **Proxy** (`src/proxy.ts`) gates `/admin` to owner only (checks `isOwnerUser(user)`). Signed-out → `/login` with `next` param; signed-in non-owner → `/`.
2. **Admin layout** (`src/app/admin/layout.tsx`) renders `AdminShell` + `DeploymentCapabilitiesProvider` + children. No `next-intl` provider; no `SiteHeader`/`SiteFooter`.
3. **Admin page** reads module data (e.g. `getAdminAppointments` from `@/modules/booking/reads`) — uses the **authed** Supabase client; RLS may apply owner-reads-all policies.

### 3.3 Mutation flow (e.g. booking creation)

1. Client component imports `[@/modules/booking/actions]` (each file is `"use server"`). This is the **only** authorized path for mutations from the browser.
2. Module action runs with the **service-role** client (bypasses RLS), or the session client if owner-scoped. Returns `{ ok, message? }`.
3. On success, `revalidatePath` may fire (from `src/modules/revalidate.ts`) to invalidate the homepage/gallery cache.

### 3.4 Revalidation flow

- `src/modules/revalidate.ts` exports three functions:
  - `revalidateLocaleHomes()` — revalidates `/<locale>` for each locale.
  - `revalidatePublicShell()` — revalidates `/[locale]` layout (footer lives here).
  - `revalidatePublicSurfaces()` — revalidates `/<locale>` and `/<locale>/gallery`.
- All use `import "server-only"` and `revalidatePath` from `next/cache`.

### 3.5 Request config (i18n middleware)

- `src/proxy.ts` is the Next.js middleware handler. It:
  - Creates a Supabase server client with cookie persistence.
  - Refreshes session cookies on every request.
  - Gates `/admin` to owner only.
  - Gates protected client paths (`/((da|en)/appointments/...)`) to signed-in users.
  - Runs `next-intl` middleware for locale negotiation (`/` → `/da`).
  - Carries refreshed cookies onto redirect/rewrite responses.
## 9. Architectural Risks / Incomplete Functionality

| Risk | Evidence | Priority |
|---|---|---|
| **No analytics** | Confirmed absent in code and `docs/product-review.md:4`: "**no analytics in the app** (no Plausible/PostHog/Vercel Analytics — checked). Fixing that is item 0 of the backlog." | Critical — "flying blind" |
| **Clerk references are historical** | `docs/PLAN.md` references Clerk as "retired"; all current auth is Supabase. If a future phase re-introduces Clerk, the module barrel / auth boundary will need re-evaluation. | Medium |
| **`bookings` RLS is intentionally deny-all** (Phase 4 pending) | `docs/PLAN.md:103`: "⬜ `bookings` RLS (owner-reads-all + user-reads-own keyed off Clerk `sub`) → Phase 4." | High — booking flow depends on this |
| **Gallery ordering guardrails not yet applied** | `docs/PLAN.md:102`: "⬜ Gallery homepage ordering guardrails ... Apply to the live DB before the admin/gallery management flow is considered complete." | Medium |
| **Indices deferred** | `docs/PLAN.md:102`: "⬜ Indices — deferred; confirm which query paths need them once Phase 7 read patterns exist." | Low |
| **`NEXT_PUBLIC_SITE_URL` defaults to test domain** | `src/config/site.ts`: `process.env.NEXT_PUBLIC_SITE_URL ?? "https://bellanails.dk"`. Currently resolves to `https://test.bellanails.dk`; deploys as staging, crawlers blocked. Domain claim pending. | High — blocks search engine indexing |
| **`HUMAN_CHECK_SECRET` may be absent** | `src/instrumentation.ts`: warns if not set; the "I'm not a robot" check is never shown and bookings are never asked for a proof. | Medium |
| **`BOOKING_TOKEN_SECRET` falls back to service-role key** | `docs/tasks/TODO.md`: "Give `BOOKING_TOKEN_SECRET` its own value ... It falls back to the service-role key, so every emailed manage / approve / offer / testimonial link is signed with it. Rotating that key would kill all of them at once." | Medium |
| **Scaleway env var present but unused** | `src/config/site.ts` / `TODO.md`: `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` "read by nothing — storage is Supabase Storage". | Low |
| **Admin area has no locale prefix** | `src/app/admin/layout.tsx` is English-only; the proxy handles `/admin` gating. If a future need arises for multilingual admin, the layout will need rearchitecting. | Low |
| **Test coverage is sparse** | 26 test files for a codebase of this size; no e2e suite; critical flows (booking → admin queue → confirmation) not fully covered. | High (process risk) |
## 6. Testing

| Metric | Value |
|---|---|
| **Test files** | 26 files (mix of module tests, shared‑logic tests, notification-email tests) |
| **Test command** | `pnpm test` → `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/register-ts-paths.mjs --test "src/**/*.test.ts"` |
| **Coverage** | Not configured in `package.json`; no `--coverage` flag in the test script. |
| **Test distribution** | - `src/modules/design/offer-token.test.ts`<br>- `src/modules/notifications/email-layout.test.ts`<br>- `src/modules/testimonials/token.test.ts`<br>- `src/modules/server-actions.test.ts`<br>- `src/shared/` (18 files tested)<br>- `src/app/[locale]/confirmation/_components/confirmation-recap.tsx` (uses `useQuery`)<br>- `src/hooks/use-current-user.ts` (unit‑style) |
| **Test pattern** | Mostly unit / integration of pure functions and view models. End-to-end flows (booking from client → admin queue) are not yet covered. |
## 10. Prioritized recommendations

### P0 — Must fix before launch

1. **Add analytics** — select one (Plausible, Vercel Analytics, or self‑hosted) and integrate it. This is item 0 of the backlog and the app is "flying blind."
2. **Set `NEXT_PUBLIC_SITE_URL` to the production domain** (`https://bellanails.dk`) and add the domain to Vercel. Without this, every deploy is treated as staging, `noindex` is active, and crawlers are blocked.
3. **Set `bookings` RLS** — apply the Phase 4 SQL (owner-reads-all + user-reads-own keyed off Clerk `sub` or the chosen auth model), regenerate `src/db/supabase/types.ts`, and verify the booking flow end-to-end.
4. **Apply gallery ordering guardrails** — add the `sort_order` default/unique constraints from `supabase/gallery-ordering.sql` to the live DB before the admin/gallery management flow is considered complete.
5. **Give `BOOKING_TOKEN` its own random value** and rotate it away from the service‑role key.

### P1 — Should do in the next cycle

6. **Add indices** on query paths that are frequent (e.g. client bookings by date, gallery featured items, pending requests count).
7. **Claim + fill Google Business Profile** — primary category "Neglesalon" is the biggest local ranking factor.
8. **Core citations, identical NAP** — Krak, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Google Places.
9. **Social URLs** — populate the three social links so the footer shows them and JSON‑LD carries `sameAs`.
10. **Phone number + geo coordinates** — deliberate omission from the schema; add if/when ready (currently Google would display a made‑up number from structured data).
11. **Images + copy for `/` and service pages** — `frame_items`, `service_sections`, and `reviews` are all empty; C2 and C3 wait on content, not code.
12. **Set `HUMAN_CHECK`** (or remove the boot warning if the feature is not wanted).
13. **Clean up Scaleway env var** — `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` is read by nothing; remove it.

### P2 — Could do later

14. **Clerk re‑evaluation** — if the product decides to bring back an external auth provider, audit the module‑barrel boundary and the `db/` / `modules/` import rules.
15. **End‑to‑end test suite** — Cypress/Playwright covering the full booking flow (client books → admin queue → confirmation → client manages).
16. **Promote co‑located `_components/` to `src/components/`** when a second route genuinely needs them (currently the rule is "promote when a second route uses it").
17. **Refine `local-business.ts`** — add `telephone` and `geo` when the schema is ready; ensure `addressLine1/Line2` + `postTown` are populated from `business_profile`.

### P3 — Nice‑to‑have / refactor

18. **body `packages/core`** — the four layers are already UI‑free and dependency‑directed; extracting a shared package is a move, not a rewrite. Only when a second deployable (native app, separate PWA cadence) is real.
19. **Add `src/db/README.ts`** to match the `README.md` that already exists — keep the contract description in sync.
20. **Audit module barrel exports** — verify every export in each module's `index.ts` is intentional and documented as the answer to a page's question.
## 10. Prioritized Recommendations

### P0 — Must fix before launch

1. **Add analytics** — select one (Plausible, Vercel Analytics, or self‑hosted) and integrate it. This is item 0 of the backlog and the app is "flying blind."
2. **Set `NEXT_PUBLIC_SITE_URL` to the production domain** (`https://bellanails.dk`) and add the domain to Vercel. Without this, every deploy is treated as staging, `noindex` is active, and crawlers are blocked.
3. **Set `bookings` RLS** — apply the Phase 4 SQL (owner-reads-all + user-reads-own keyed off Clerk `sub` or the chosen auth model), regenerate `src/db/supabase/types.ts`, and verify the booking flow end-to-end.
4. **Apply gallery ordering guardrails** — add the `sort_order` default/unique constraints from `supabase/gallery-ordering.sql` to the live DB before the admin/gallery management flow is considered complete.
5. **Give `BOOKING_TOKEN` its own random value** and rotate it away from the service‑role key.

### P1 — Should do in the next cycle

6. **Add indices** on query paths that are frequent (e.g. client bookings by date, gallery featured items, pending requests count).
7. **Claim + fill Google Business Profile** — primary category "Neglesalon" is the biggest local ranking factor.
8. **Core citations, identical NAP** — Krak, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Google Places.
9. **Social URLs** — populate the three social links so the footer shows them and JSON‑LD carries `sameAs`.
10. **Phone number + geo coordinates** — deliberate omission from the schema; add if/when ready (currently Google would display a made‑up number from structured data).
11. **Images + copy for `/` and service pages** — `frame_items`, `service_sections`, and `reviews` are all empty; C2 and C3 wait on content, not code.
12. **Set `HUMAN_CHECK`** (or remove the boot warning if the feature is not wanted).
13. **Clean up Scaleway env var** — `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` is read by nothing; remove it.

### P2 — Could do later

14. **Clerk re‑evaluation** — if the product decides to bring back an external auth provider, audit the module‑barrel boundary and the `db/` / `modules/` import rules.
15. **End‑to‑end test suite** — Cypress/Playwright covering the full booking flow (client books → admin queue → confirmation → client manages).
16. **Promote co‑located `_components/` to `src/components/`** when a second route genuinely needs them (currently the rule is "promote when a second route uses it").
17. **Refine `local-business.ts`** — add `telephone` and `geo` when the schema is ready; ensure `addressLine1/Line2` + `postTown` are populated from `business_profile`.

### P3 — Nice‑to‑have / refactor

18. **Extract `packages/core`** — the four layers are already UI‑free and dependency‑directed; extracting a shared package is a move, not a rewrite. Only when a second deployable (native app, separate PWA cadence) is real.
19. **Add `src/db/README.ts`** to match the `README.md` that already exists — keep the contract description in sync.
20. **Audit module barrel exports** — verify every export in each module's `index.ts` is intentional and documented as the answer to a page's question.
---
## Appendix A: Verified Counts (as of inspection)

| Category | Count|
|---|---|
| `src/modules/*/index.ts` domains | 11|
| `src/db/*.ts` table files | 36|
| `src/shared/*.ts` files | 67|
| Test files (`*.test.ts` / `*.test.tsx`) | 26|
| `src/components/*/` directories | 9|
| `src/hooks/*.ts` files | 3|
| Platform client files (`src/foundation/**/*.ts`) | 11|
| `src/app/**/page.tsx` (public + admin) | 44|
| `src/app/**/route.ts` (API + manifest + icons) | 5|
| `src/app/**/layout.tsx` (public + admin) | 2|
| `src/app[i18n]/*/` route groups | 21 public + 21 admin|
| `src/config/routes.ts` indexable routes | 6|
| `src/config/routes.ts` disallowed paths | 9|

---

## Appendix B: Key File Paths (absolute)

| Layer | Key files|
|---|---|
| `app` | `src/app[da|en]/layout.tsx`, `src/app[da|en]/admin.tsx`, `src/app/manifest.webmanifest/route.ts`, `src/app/icons/route.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`|
| `modules` | `src/modules/booking/index.ts`, `src/modules/booking/actions.ts`, `src/modules/booking/reads.ts`, `src/modules/identity/index.ts`, `src/modules/business/index.ts`, etc. (all 11 domains)|
| `db` | `src/db/bookings.ts`, `src/db/clients.ts`, `src/db/services.ts`, etc. (36 files)|
| `platform` | `src/figure/supabase/server.ts`, `src/figure/supabase/client.ts`, `src/figure/supabase/ssr.ts`, `src/figure/email/client.ts`, `src/figure/supabase/types.ts`|
| `shared` | `src/shared/local-business.ts`, `src/shared/booking-policy.ts`, `src/shared/booking-view.ts`, `src/shared/schedule.ts`, etc. (67 files)|
| `providers` | `src/components/providers/query-provider.tsx`|
| `config` | `src/config/site.ts`, `src/config/routes.ts`, `src/config/brand.ts`, `src/config/fonts.ts`|
| `i18n` | `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`|
| `eslint` | `eslint.config.mjs` (8-layer boundary enforcement)|

*End of Architecture Analysis.*
| **Key test observations** | - `confirmation-recap.tsx` is a client component that uses `useQuery` from TanStack Query to fetch the booking recap.<br>- `next-appointment.tsx` similarly uses `useQuery` keyed by `clientId` + `locale`.<br>- `requests-banner.tsx` uses `useQuery` for pending-requests and unread-design-replies counts.<br>- No Cypress / Playwright e2e suite detected. |