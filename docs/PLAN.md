# Bella Nails — Build Plan

> Phased, dependency-ordered plan to take Bella Nails from scaffold to MVP.
> Honors the locked build order: **design system → i18n/routes → schema → integrations → features**.
> See [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) for the why, and [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for the how of each service.

Legend: ✅ done · 🔼 in progress · ⬜ todo

---

## Shipped since last plan update (August 2026)

Large tranches landed that the phase sections below predate — recorded here so the plan reflects reality (feature docs in `docs/tasks/{terms-and-media,service-detail}/PLAN.md`):

- ✅ **Legal**: `/terms` + `/privacy` pages (DB-backed, versioned, bilingual), admin `/admin/terms` management (each save publishes a new version), Legal footer column, terms linked at booking. **Supersedes the ⬜ items in Phase 7 (lines re: `/terms` 404) and the Phase 9 legal-page todo** — copy still needs the owner's final legal text.
- ✅ **Photo consent + media + asset system** (Phase 8 Tasks 07/08/09 substantially built): private `client_media`, per-image `media_consents` (site/social), copy-on-consent publish to public `assets`, the `/admin/assets` hub (place consented photos onto surfaces via `asset_usages`), client Gallery with plain-language sharing + one-tap withdrawal, withdraw-in-use retention, owner notifications, real GDPR erasure. Client photos on `/gallery` + home showcase render from consented placements.
- ✅ **Terms acceptance tracking**: `terms_acceptances` records service terms (at booking) + data-use terms (per photo consent) per client; shown on the admin client page.
- ✅ **Service catalog depth**: unique service/add-on names (enforced), **price history**, add-on incompatibilities moved into the add-on edit dialog, service **content sections** (image+text) with a consented/upload image picker, per-service **detail pages** `/services/[id]` ("Learn more" → sections + "By the studio"/"What clients say" galleries + floating Book CTA), and **reviews**.

**Reviews vs testimonials — decided (Aug 2026): keep BOTH as separate concepts.**
- **`reviews`** = per-service, studio-entered, shown in "What clients say" on the service detail page. ✅ Built.
- **`testimonials`** = global, client-submitted / studio-curated (Phase 7/8 Task 09 — `quote`, `author_name`, `author_role`, `status`, `sort_order`). ⬜ To build; the home Testimonials section reads i18n until then.

Migrations applied: `terms.sql`, `price-history.sql`, `service-sections.sql`, `reviews.sql` (+ owner-notifications, asset-usages, asset-hub, storage-provider). Optional: `name-uniqueness.sql`.

---

## Feature flags (Aug 2026)

`src/config/features.ts` is the on/off surface for optional features. **Base** features are always on; **optional** ones can be hidden per env (`NEXT_PUBLIC_FEATURE_<KEY>=off`) or by flipping `enabled`. Wiring is incremental — a flag gates only where it's checked. Owner to confirm the base/optional split:

| Feature | Flag key | Base / Optional |
|---|---|---|
| Booking flow | `booking` | Base |
| My Space / appointments | `appointments` | Base |
| Client consent + media | `clientConsent` | Base |
| Terms & privacy | `terms` | Base |
| Admin catalog | `adminCatalog` | Base |
| Service detail pages + sections | `serviceDetail` | Optional |
| Consented client photos on service pages | `serviceGallery` | Optional |
| Home "recent client work" showcase | `homeShowcase` | Optional |
| Per-service reviews | `reviews` | Optional |
| Global testimonials | `testimonials` | Optional (not built) |
| Artist favourites | `favorites` | Optional |

---

## Phase 0 — Scaffold & repo hygiene ✅

- ✅ Next 16 + React 19 + Tailwind v4 + shadcn `base-luma` scaffolded; pnpm via corepack.
- ✅ Brand tokens + fonts wired (`globals.css`, `layout.tsx`).
- ✅ Replaced default `page.tsx` boilerplate with on-brand placeholder; real root `metadata` (title template + `metadataBase`).
- ✅ Added `.env.example` (all keys, no secrets); `.gitignore` exempts it (`!.env.example`) so it commits while `.env.local` stays ignored.
- ✅ `pnpm lint` and `pnpm build` green (TypeScript passes; `/` prerenders static).
- ⬜ *(optional)* Remove leftover `public/next.svg`, `public/vercel.svg` from create-next-app — no longer referenced.

## Phase 1 — Design system primitives (FIRST) ✅

Goal: an on-brand component kit so every later feature is consistent from day one.

- ✅ **Typography system** (`src/components/ui/typography.tsx`) — cva-based, derived from the landing comp: `Display`, `H1`, `H2`, `H3`, `Eyebrow`, `Lead`, `Body`, `BodySm`, `Quote`, `Caption`. Cormorant italic enabled in the font loader (roman+italic heading signature).
- ✅ `/styleguide` page (noindex) previewing the type scale against real landing copy.
- ✅ **Button** (`button.tsx`) — re-themed base-luma/base-ui: squared corners, uppercase + `tracking-ui-button`, `default` (Onyx) + `inverse` (light-on-dark hero) variants, sizes sm/default/lg.
- ✅ **PriceTag** (`price-tag.tsx`) — cents→amount, editorial face, `Intl.NumberFormat` (locale prop), `sign` for add-on deltas.
- ✅ **Form set** — `input`, `textarea`, `label`, `checkbox`, `separator` re-themed to the comp: underline-only inputs (`border-b`), uppercase muted `Label` (= `Caption`), squared Onyx `Checkbox`. Later: `card`, `dialog`, `sheet`, `dropdown-menu`, `badge`, `skeleton`, `sonner`, `tabs`, `select`, `avatar` as needed.
- ✅ Verified tokens + fonts: every component token class resolves in `@theme`; brand hexes + self-hosted Cormorant/Jakarta `.woff2` confirmed in compiled output. Added missing `--destructive` (muted `#8e2c2c`) that the destructive variant + all `aria-invalid` states reference.
- ✅ Layout shells (`src/components/layout/`): `Container`/`Section`, `SiteHeader` (wordmark, localized nav, `LocaleToggle`, `AuthControls`, Book CTA), `SiteFooter` (wordmark, tagline, rights). Header/footer mounted in `[locale]/layout.tsx`; `LanguageToggle` shipped as `LocaleToggle` in Phase 2. Also added `/[locale]/account` (`<UserProfile/>`, proxy-protected). ⚠️ Header nav targets (`/services`, `/gallery`, `/book`) resolve in Phases 6–7. Note: the global header's auth controls make `[locale]` pages dynamic (auth state per request).
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
- 🔼 Gallery homepage ordering guardrails prepared in [supabase/gallery-ordering.sql](../supabase/gallery-ordering.sql): `sort_order` defaults to `null`, only allows slots `1..5`, and is unique when set so at most five gallery items can be featured on the home page at once. Apply to the live DB before the admin/gallery management flow is considered complete.
- ⬜ Indices — deferred; confirm which query paths need them once Phase 7 read patterns exist.
- ⬜ `bookings` RLS (owner-reads-all + user-reads-own keyed off Clerk `sub`) → Phase 4. Advisors correctly still flag `bookings` as RLS-enabled-no-policy (intentional deny-all until then).
- ⬜ **Clients keyed to Clerk, no PII in our DB (Phase 8 dependency):** rather than storing client email/name in our tables, the Phase 6 webhook (and the out-of-hours request flow) **create-or-find a Clerk user by the attendee email** (Clerk Backend API, passwordless) and store only the pseudonymous `clerk_user_id`. So `bookings` needs **no schema change** — `clerk_user_id` stays `NOT NULL`, Cal.com keeps populating `cal_booking_id` / `cancel_url` / `reschedule_url`, and PII lives in Clerk. The only new table is `booking_requests` for out-of-hours requests (see Phase 8; SQL in [supabase/booking-requests.sql](../supabase/booking-requests.sql)). Regenerate `src/lib/supabase/types.ts` after applying.

## Phase 4 — Auth (Clerk + Supabase native) ✅

> ⚠️ **Superseded by [Phase 11](#phase-11--in-house-scheduling--identity-retire-calcom--clerk)**
> (August 2026): Clerk is being replaced by Supabase Auth + an own `clients` table. Everything
> below still describes the live system — don't build *new* Clerk surface area on it.

- ✅ Installed `@clerk/nextjs@7.5` (peer-supports Next 16). `ClerkProvider` added inside `[locale]/layout.tsx` (`<body>`), composed with `NextIntlClientProvider`, with locale-aware `signInUrl`/`signUpUrl`.
- ✅ `clerkMiddleware` merged into `src/proxy.ts` alongside next-intl (Next 16 supports `clerkMiddleware` from `proxy.ts` on the Node runtime — verified in the SDK). `/[locale]/admin` matcher present with `auth.protect()` (owner-role refinement deferred to the admin shell, Phase 8).
- ✅ Locale-aware `sign-in`/`sign-up` catch-all pages under `[locale]/`; auth controls (`Show`/`SignInButton`/`SignUpButton`/`UserButton`, brand-styled) on the home page. Home page is now dynamic (auth state per request).
- ✅ Clerk keys in `.env.local` (dev instance) + Clerk **Connect with Supabase** + **Supabase Third-Party Auth** (Clerk) configured (not the deprecated JWT template). ⚠️ Production is a **separate** Clerk instance (new `pk_live`/`sk_live` keys, custom domain) needing its **own** Supabase Third-Party Auth entry — set up in Phase 9.
- ✅ Clerk token wired into the Supabase clients: browser `useSupabaseBrowserClient()` (Clerk session via `accessToken`, anon fallback) + server `createAuthedSupabaseServerClient()`. The plain anon `createSupabaseServerClient()` stays for static-friendly public reads.
- ✅ `bookings` RLS: `Users read own bookings` (`(select auth.jwt()->>'sub') = clerk_user_id`), applied + **verified** (simulated Alice sees only her row; anon sees none). Security advisors clean. Writes remain service-role (webhook). Owner-reads-all → Phase 8.
- ✅ Polish: `@clerk/ui` **shadcn theme** on `ClerkProvider` (Clerk widgets inherit our brand tokens) + `@clerk/localizations` (`daDK`/`enUS`) driven by the active locale. eslint ignores the vendored `.agents/`/`.claude/` skill dirs.
- ⬜ ⚠️ If using a Clerk **custom domain** (production), test authed Realtime early (JWKS `/.well-known/jwks.json` vs `/jwks` 404 bug) → Phase 9.

## Phase 5 — TanStack Query + Realtime wiring

> **Decided (July 2026): this phase lands as part of Task 04 (`/bookings`), not standalone.**
> `@tanstack/react-query` is installed but unused — the booking flow turned out to be
> almost entirely server-rendered (URL-driven steps, RSC reads), and the app's first
> client-side fetch (the /confirmation recap poll) is a single fire-once request that
> didn't justify mounting the provider. The `/bookings` page is the first surface with
> TanStack-shaped needs: a user-keyed list, reschedule/cancel mutations with cache
> invalidation, and the Realtime subscription. Build the wiring there, where it has
> consumers; migrate the confirmation recap onto `useQuery` in the same pass.

- ✅ `QueryClientProvider` mounted app-wide (July 2026) — landed with its first consumer, the home page "next appointment" card (`next-appointment.tsx`: pure fetch fn + `useQuery` keyed by user+locale, no effects). 60 s staleTime, no refetch-on-focus.
- ✅ /confirmation recap migrated to `useQuery` (July 2026) — the hand-rolled retry loop became `retry`/`retryDelay` config; 404-during-webhook-lag throws and retries on the same 1.5/4/8/15 s tail. **Decided: `/bookings` stays server-rendered** (RLS-authed RSC read is the better architecture for a read-only list) until in-place cancel/reschedule mutations or Realtime arrive — don't convert it to client fetching for consistency's sake.
- 🔼 Realtime on `bookings` — shipped for the **admin live queue** (Task 02: `QueueRealtime` subscribes to `postgres_changes` via the Clerk-authed browser client so owner-reads-all RLS scopes it studio-wide, debounced → `router.refresh()`). **Decided: `router.refresh()`, not `invalidateQueries`** — the queue is a server-rendered RSC read, so re-running it keeps that authoritative and needs no TanStack cache/provider (client collapse/view state survives the refresh). ⬜ Verify the two-browser live update on the deployed host. Booker side stays RLS-safe (authed `postgres_changes` on own rows); the confirm step's post-booking probe could still upgrade to a uid-scoped broadcast channel (see `booking-embed.tsx` — the wait is the UX, the transport is swappable in `waitForBookingRow`).
- ⬜ (Later) shadcn data-table for the admin queue.

## Phase 6 — Booking flow (Cal.com + Stripe)

> ⚠️ **Engine superseded by [Phase 11](#phase-11--in-house-scheduling--identity-retire-calcom--clerk)**
> (August 2026): scheduling comes in-house and Cal.com is removed. The **domain decisions below
> survive unchanged** (add-on duration model, round-up rule, 24 h notice, 30-min buffer,
> metadata shape, localization split) — they are the spec the new engine must satisfy. Treat
> anything Cal-*mechanical* (event types, API v2 sync, embed, webhook) as scheduled for
> deletion; don't invest further in it.

### Cal.com account state (done July 2026)

- ✅ Account live on the **EU instance** — booking URLs are `cal.eu/bellanails/*` and API calls go to `api.cal.eu` (⚠️ not `cal.com` — embed config, `NEXT_PUBLIC_CALCOM_LINK`, and API base must all point at the EU instance).
- ✅ Five event types created, one per service, `cal_event_id` attached via [supabase/cal-event-ids.sql](../supabase/cal-event-ids.sql) (363871 gel-extension · 363953 the-classic-manicure · 363957 classic-manicure · 363961 shellac-biab · 363966 gel-polish).
- ✅ Each event type: in-person location only (address `public:false`), `minimumBookingNotice` 1440 (24 h, matches the cancellation policy), `afterEventBuffer` 30, hidden from the public profile, duration selector hidden on the booking page.
- ✅ Zoho Calendar sync **skipped** (EU-DC OAuth kept failing) — the Cal.com dashboard/app is the artist's booking calendar; Google Calendar is the fallback if external sync is ever needed. Zoho stays email-only.
- ⬜ Verify the account's **default availability schedule** is the real studio hours — every event type has `scheduleId: null` (= default schedule governs all bookability).
- ⬜ Stripe **deferred** (owner undecided): no-show holds are per-event-type Cal config, can be enabled later with zero app changes. When enabling, set currency to DKK (event types currently report `usd` default).

### Custom durations (add-on model) — decided

- **Only the main service's `cal_event_id` is ever sent to Cal.** Add-ons have no Cal identity; the app computes totals and picks a slot length.
- Each event type has **multiple durations** in **15-minute steps from the base to base + max compatible add-on sum** (e.g. gel-extension: 90/105/120/135). At booking, the app `ceil`s the true total to the smallest offered option — **round up, never down** (over-reserving ≤14 min is fine; under-reserving collides bookings). Steps start from the base, so non-grid bases (45) still offer themselves.
- ⚠️ The Cal **UI duration picker only offers preset values** (nothing between 90 and 120) — options like 105/135 must be written via **API v2** (`lengthInMinutesOptions`, header `cal-api-version: 2024-06-14`), which accepts arbitrary ints. The Phase 8 admin sync owns this; until then any duration change is an API PATCH, not a dashboard edit.
- Buffer applies **once per booking** on top of the chosen duration (client sees 105, calendar blocks 135 with the 30-min buffer).

### Localization across the Cal boundary — decided

- Cal event-type `description` is a **single-language static field** (no per-locale variants) — keep it a short bilingual/Danish one-liner; all real localized copy lives in Supabase and renders on `/services` + `/book` before the embed opens.
- **Per-booking localized summary**: `/book` composes a human-readable, locale-aware summary of the full selection ("Klassisk Gelforlængelse (90 min) + French tips (+15 min) · i alt 105 min · 700 kr.") and prefills it into the **notes/booking field** (visible to artist + in client emails, in the booker's language).
- **Machine payload in `metadata`** (IDs only, never parse the human string): `{ serviceId, addonIds[], totalPriceCents, totalDurationMins, locale }` — this is what the webhook persists into `bookings.selected_addons` / `total_price_cents`.
- ⚠️ **Embed UI language cannot follow the site locale** — Cal cloud auto-detects the *browser* language and offers no per-visitor override (open requests calcom/cal.com#8904, #18710). Decided: keep auto-detect (matches the visitor better than anything we can force); the per-event `interfaceLanguage` field could force one fixed language for all visitors, rejected because EN-site visitors would get a Danish booker. Revisit if Cal ships a `?language=` param.
- Consider the event-name template (interpolating a booking field) so the artist's calendar shows "Gel Extension + French tips — {name}" per appointment.

### One event type per service — decided (July 2026)

- Considered collapsing to a single generic "session" event type (duration overridden per booking anyway) — **rejected**: the webhook's `eventTypeId` is the tamper-proof service identity (booking `metadata` is client-controllable via URL params), and per-service knobs (distinct buffers, price-proportional Stripe holds, per-treatment availability) all require distinct event types. `cal_event_id` stays `NOT NULL UNIQUE`.
- Event types stay **deliberately uniform**: one template (in-person address, 1440 notice, 30 after-buffer, hidden from profile, duration selector hidden) stamped per service — only slug/title/description/duration-grid differ. The admin sync then only ever writes those four fields.
- ⚠️ **The current five services are placeholders** — the owner will rebuild the real catalog. Sequencing decided: ship `/book` against the placeholders (validates the whole pipeline) → pull the **admin services CRUD forward from Phase 8** (create/update/archive with Cal event-type sync) → owner rebuilds the catalog through the admin, which doubles as its real-world test.
- Admin↔Cal sync mechanics: server action `POST/PATCH api.cal.eu/v2/event-types` (header `cal-api-version: 2024-06-14`) using a **server-only** `CALCOM_API_KEY`; create returns the `id` stored as `cal_event_id`; archive sets `archived_at` + hides the event type. Verified working against the live EU account (duration grid + description PATCHes, July 2026).

### Build

> **Agent task briefs for Phases 6–7 booking completion:** [`tasks/booking-completion/`](./tasks/booking-completion/) — dependency-ordered, one branch/PR each (01 embed · 02 webhook+identity · 03 confirmation · 04 bookings). Read `00-context.md` first.

- ✅ Install `@calcom/embed-react`; themed embed (`brandColor` Onyx, `bodyBg` Alabaster, matching fonts/radii), pass language. Point it at the **EU instance**.
- ✅ Service/add-on selection UI → compute total (cents) + duration; handle `addon_incompatibilities`. Reads the `?service=<uuid>` preselect that the `/services` menu rows already send.
- ✅ The app owns service/add-on selection and booking summary; **Cal.com owns availability search and date/time selection**. Do not build a separate first-party slot picker unless a later requirement proves Cal.com cannot satisfy the UX.
- ✅ Hand off the chosen service/add-on context into Cal.com (`?duration=` + the prefills above) so users land directly in the smarter availability step rather than re-entering booking context.
- ✅ Add booking consent copy linking to `/[locale]/terms` (+ `/privacy`) anywhere users submit or confirm a reservation. **The `/terms` + `/privacy` pages now exist** (Aug 2026 — DB-backed, see "Shipped since last plan update").
- ⬜ Define the studio guarantee terms before promising them in booking copy: coverage window by treatment type, what counts as normal wear, exclusions, contact method, and proof/repair flow.
- ✅ Redirect to own `/[locale]/confirmation` on success.
- ✅ `/api/webhooks/cal` — validate signature, on `BOOKING_CREATED` upsert into `bookings`. ⚠️ Create the webhook in Cal (Settings → Developer → Webhooks, secret → `CALCOM_WEBHOOK_SECRET`) only once this endpoint exists; earlier deliveries would just fail.
- ⬜ Stripe no-show card holds via Cal.com (SetupIntents) — config in Cal.com + Stripe dashboards. **Deferred** (see account state above).

### End-to-end test scenario (run once `/book` ships)

Owner walkthrough — verifies every decision above in one pass:

1. **Locale + preselect**: from `/da/services`, click the "Gel Polish" row → `/da/book?service=59c02169…` opens with Gel Polish preselected, Danish copy, correct price/duration shown.
2. **Add-on math**: select an add-on → total price and duration update; try an incompatible pair → UI blocks it. Confirm the computed duration rounds *up* to the next offered step.
3. **Embed handoff**: continue to the embed → it opens `cal.eu/bellanails/gel-polish` with the *chosen* duration (no duration selector visible), Danish UI, brand theming, and slots only within studio hours (default-schedule check).
4. **Notice + buffer**: verify no slots are offered within the next 24 h, and after booking, the next available slot sits ≥30 min after the booked treatment ends.
5. **Booking data**: complete a real test booking (use a personal email) → confirmation email arrives with the localized summary in the notes; the Cal dashboard booking shows the same summary + metadata; the calendar event title/duration are correct.
6. **Webhook sync**: the `bookings` row appears in Supabase with `cal_booking_id`, correct `total_price_cents`, `selected_addons` populated from metadata, and `clerk_user_id` resolved from the attendee email.
7. **Confirmation page**: the success redirect lands on `/da/confirmation` (locale preserved).
8. **Lifecycle**: use the emailed links to reschedule, then cancel → the Supabase row status updates on each webhook event; cancelling inside 24 h is blocked by policy.
9. **Repeat 1–3 in English** (`/en/services` → `/en/book`) — everything mirrors except the notes summary language, which follows the booker.

### Improvements from the first deployed test round (July 2026)

Found while running the E2E scenario on the test deployment (`test.bellanails.dk`, Vercel CLI — see [DEPLOY-TEST.md](./DEPLOY-TEST.md)). Core chain verified working: booking → Cal → signed webhook → Supabase row → Clerk identity.

- ✅ **Home page featured services should be clickable** — the ServicesPreview rows on the main page don't link anywhere; clicking a service should deep-link to `/book?service=<uuid>` and land on the add-on step, same as the `/services` menu rows already do.
- ✅ (router.replace shipped; completed-marker deemed unnecessary) **Reset the flow after a completed booking** — the whole flow state lives in the URL, so after a successful booking, browser-back (today: back from the `/confirmation` 404) restores the confirm step fully armed and the user can double-book in two clicks. On `bookingSuccessfulV2`, navigate with **`router.replace`** (not `push`) so the confirm URL drops out of history, and consider marking the completed booking (e.g. session flag keyed by uid) so a revisited confirm step redirects to step 1 / the confirmation page instead of re-arming the embed.
- ⬜ **Branded transactional emails for every stage** — Cal's default emails are generic and off-brand. Cover: booking confirmation, reminder(s) before the appointment, cancellation, and reschedule. **Decided August 2026 → [Phase 11](#phase-11--in-house-scheduling--identity-retire-calcom--clerk) step 1–2: we send our own** (ZeptoMail + `scheduled_emails` + Cron). Cal **Workflows** is dropped — it can't fix the off-brand manage-links and it's machinery we're deleting anyway. This is the phase's *first* step precisely because it's the owner's actual complaint and it's additive/zero-risk.

## Phase 7 — Public site features 🔼

- 🔼 **Home page built to the Figma comp** as responsive, localized (da/en) sections in `src/components/sections/` — one branch each (`bellaNails-home-*`): Hero, ServicesPreview, Formula, Differentiators, StudioGallery, Testimonials, FindUs (+ header/footer revamp). All use the design system (typography, tokens, Container/Section). Stacked branches off `main`; assembled in `[locale]/page.tsx`. Verified: both locales 200 with all sections.
  - ✅ Home / hero (Quiet Luxury landing) — full-bleed, editorial headline, Reserve CTA, scroll cue.
  - ✅ "The Formula" section — Didier Lab positioning (HEMA-free · vegan · cruelty-free · fiberglass-reinforced · Vitamin E + calcium), personal first-person framing.
  - ✅ **ServicesPreview** reads featured `services` from Supabase (localized, PriceTag).
  - ✅ **Full Services menu page** (`/services`, PR #17, July 2026) — "The Menu / Treatments & Care": data-driven category sections (`categories` + embedded `services`, ordered by `sort_order`; catalog restructured into Classic Manicure / Shellac & BIAB / Gel Extensions via [supabase/categories-menu.sql](../supabase/categories-menu.sql)), hoverable service rows deep-linking `/book?service=<uuid>`, SEO keyword intro copy (per [seo-plan.md](./seo-plan.md) Tier 2/3) + localized keyworded image alts, pricing/policy fine-print close. Also fixed the site-wide invisible `Separator` (classes targeted `data-horizontal`; base-ui emits `data-orientation`). Category images reuse the hero placeholder until real Scaleway photos land. Add-ons not shown on the menu yet — decide presentation with `/book`.
  - 🔼 Gallery (`gallery_items`: portfolio + before/after; Scaleway `public/` objects, no CDN transforms) — home StudioGallery now reads DB-backed items; next step is replacing temporary reused imagery with curated live assets and finishing the full gallery page/admin flow. **Committed client-facing (July 2026): the /gallery page ships before launch** (✅ page now exists — renders studio imagery + consented client work from the asset hub; owner curates via `/admin/assets`). Lookbook nav + route removed (Aug 2026).
  - ✅ **Contact area (July 2026): email-first, no messaging system.** `STUDIO_EMAIL = hello@bellanails.dk` shipped in FindUs, footer, and the within-24h note (now actionable). Phone to follow when supplied. Publish the studio's public email + phone as `src/config/studio.ts` constants (owner to supply values) and surface them in: the FindUs section (under hours), the footer contact/studio column, and make the bookings page's within-24h note actionable (it already says "call or write the studio" — currently with nowhere to click). `mailto:`/`tel:` links only; a /contact page is unnecessary while FindUs + footer carry the details.
  - 🔼 **Testimonials** — copy currently lives in i18n (da/en), fine for launch. Decision: move to a `testimonials` table (mirrors services/gallery: `quote_en/_dk`, `author_name`, `author_role_en/_dk`, `sort_order`, `is_published`, `archived_at`; public read via RLS) so the owner can manage them — build it with the admin (Phase 8). Note: real client quotes are given in one language, so consider storing as-given rather than translating.
  - ⬜ Follow-ups: real photos via Scaleway (hero + gallery), real map embed on FindUs, and the flaky-locale-switch Clerk re-init (deferred to Phase 9).
  - ⬜ Footer visual differentiation pass: explore an Onyx background treatment (or similar stronger contrast move) once the final footer content settles.
- ✅ "My bookings" (July 2026) — protected page (proxy auth gate, locale-aware sign-in redirect), RLS-scoped list: upcoming cards (countdown, add-ons, stored total, 24 h policy lock) + history (cancelled/completed, "book again" deep link with add-ons preselected). Home page gets a signed-in "next appointment" band.
- ✅ **In-app cancel & reschedule (July 2026)** — no Cal-hosted pages in the client flow: cancel = confirm dialog → server action → Cal API v2 (`CALCOM_API_KEY`) → row mirrored + revalidated; reschedule = `/bookings/reschedule/[uid]` (ownership via RLS read, eligibility re-checked) hosting the themed Cal embed's reschedule view → webhook probe → back to /bookings. ⚠️ Cal's own confirmation-email buttons still point at cal.eu (not customizable on cloud) — mitigated by a "manage your booking" line in the booking notes; fully fixed by the branded-email phase.

### In-app manage hardening — DO BEFORE Phase 8 admin (senior review, July 2026)

Findings from the code review of the cancel/reschedule/notes batch. The admin
queue builds on the same action/eligibility/webhook machinery, so harden first.

**Correctness (blockers):**
- ✅ (migration applied to live DB July 16) **Deploy order:** run [supabase/booking-client-notes.sql](../supabase/booking-client-notes.sql) BEFORE deploying — the webhook writes `client_notes` unconditionally; code-before-migration 500s **all** booking persistence, not just notes.
- ✅ `cancelBooking`: wrap the Cal API fetch in try/catch — a transport failure currently throws out of the action (error boundary eats /bookings mid-dialog) instead of returning `{ok:false}`.
- ✅ (via syncBookingFromCal reconcile) `cancelBooking`: treat Cal's "already cancelled" 4xx as success → mirror row + revalidate — otherwise a ghost booking (missed cancel webhook) can never be healed in-app.
- ✅ `cancelBooking`: the `status === cancelled` early return must still `revalidatePath` (stale card stays rendered after an out-of-band cancel).
- ✅ **Live-verified July 16:** the `reschedule/<uid>` embed path renders Cal's reschedule view correctly and metadata carries to the new booking. ⚠️ Root-caused en route: reschedules fire `rescheduleBookingSuccessfulV2`, NOT `bookingSuccessfulV2` — the embeds listen for different events (note for the shell extraction). Original concern: `calLink="reschedule/<uid>"` is not Cal's documented embed pattern (embed.js allowlists `rescheduleUid`/`bookingUid` as config params on an event link). Keep a visible external `reschedule_url` link on the reschedule page until live-verified; try `config.rescheduleUid` on the event link as the documented alternative if the path form breaks. Also live-verify metadata carries to the rescheduled booking via the embed path (confirmed once via Cal-hosted reschedule).
- ✅ Cancel dialog: gate `onOpenChange` on `pending` (Esc currently escapes the "stays open while pending" contract) and map error codes to distinct toasts — `within_policy` must say "contact the studio", not "try again" (also un-deadens the `CancelResult` union).

- ✅ **Webhook latency: measured ~58 s clean delivery (no failures) — Cal's queue, not our handler.** Fixed by **sync-first**: `lib/booking-sync.ts` owns the ONE persist routine; the webhook maps onto it (push/reconciler) and `syncBookingFromCal(uid)` pulls the authoritative booking from Cal API v2 the moment either embed reports success (server action, uid-capability-guarded, probe fallback). Client lands on fresh data in ~1 s regardless of queue mood. Also: shared `CAL_UID_PATTERN` now guards recap API + cancel + sync; webhook logs every receipt for delivery-timing visibility. Verified from the API payload: metadata (incl. clientNotes) survives reschedules; 115-min treatment correctly blocked 120-min slot.

**Structure (pay down before admin builds on it):**
- ✅ One `canManageBooking(row, now)` in `lib/booking-display` — the eligibility rule is currently spelled 4 ways (card, cancel action, reschedule page, isUpcoming); `cancelBooking` skips `isActiveBookingStatus`, so future `requested/declined` statuses would be cancellable.
- ✅ (`cal-embed-shell.tsx`, success event per flow) Extract the shared Cal embed shell (theme block, listener on/off wiring, skeleton, securing overlay) — booking-embed and reschedule-embed duplicate ~70 lines incl. the listener-stacking fix.
- ✅ `SITE_URL` const in `src/config/` (trailing-slash-normalized) — the fallback is duplicated in layout metadata + the emailed manage line, where a wrong origin is unregenerable. Fixes the `//` double-slash risk.
- ✅ Reschedule page: move UI into `sections/` (page not thin), let `routes` own the `/reschedule/` sub-path, drop the baked "– Bella Nails" from `rescheduleMetaTitle` (layout template appends the brand → currently doubles), add `rescheduleMetaDescription`.
- ✅ (docblocks scoped honestly; create/reschedule share persistCalBooking) Webhook docblock says "the single write path into bookings" — no longer true (cancel action mirrors status); either route both writers through a tiny shared bookings-writer or fix the claim.
- ✅ (per-instance IP sliding window, 10/min — blunt by design; revisit if Phase 8 needs distributed limiting) **Rate-limit the unauthenticated `syncBooking` action** — it's an unmetered proxy to the Cal API key (junk-uid loops could 429 the key and break cancel/sync for real clients). Per-IP throttle or short-window per-uid dedupe; do before Phase 8 leans on the action.
- ✅ Minor: surrogate-safe truncation for `clientNotes` (`[...notes].slice(0,500)`); ineligible-reschedule bounce is silent — carry a notice back to /bookings; `.env.example`: document `CALCOM_API_KEY` as required for in-app cancel + sync. (Done: shared `CAL_UID_PATTERN` guards recap API + cancel + sync + tightened to 12+ chars; persist path is resurrection-proof and heals failed old-row closes — replay-verified.)
- ✅ **Branded localized 404 (July 2026)** — `[locale]/not-found.tsx` renders the editorial `sections/not-found.tsx` (PageHeader + recovery actions: home / menu / book) inside the site header/footer, localized da/en via a `notFound` message namespace. Because the root layout is a `[locale]` dynamic segment (no `app/layout.tsx`), unknown slugs need a `[locale]/[...rest]/page.tsx` catch-all that calls `notFound()` to force the branded page (Next would otherwise fall through to the bare root 404); a self-contained `app/not-found.tsx` (own `<html>`/`<body>`, no brand fonts/i18n) covers no-locale / bad-locale (`/fr/x`) / dotted-path routes. Live-verified: `/da|/en` unknown slugs + nested paths → 404 + branded localized body; `/fr/x` → root fallback; real routes still 200.
- ✅ **Branded localized error boundaries (July 2026)** — companion to the 404 for the "route exists but threw" case (part of Phase 9's "error boundaries"). Shared `errors` message namespace + reusable `sections`/`ui` `ErrorState` (mirrors `EmptyState`), consumed by `[locale]/error.tsx` (`'use client'` boundary for the locale subtree: branded ErrorState + retry via Next 16.2 `unstable_retry` + home, renders inside header/footer) and a self-contained `app/global-error.tsx` (own `<html>`/`<body>`, bilingual) for root-layout throws. Live-verified: a forced throw under `/da|/en` → **500** + branded localized fallback with retry, header intact. `ErrorState` is reusable for in-component boundaries that swap a single failed section.
- ✅ Localized `/terms` + `/privacy` pages shipped (Aug 2026, DB-backed + versioned via `/admin/terms`). ⬜ Owner still to supply the **final legal text** (current content is an editable starter draft).
- ✅ Terms surfaced in the footer (Legal column) and at the booking confirm step. ⬜ Consider a confirmation-screen reference if useful.

## Phase 8 — Admin

> **Agent task briefs:** [`tasks/admin/`](./tasks/admin/) — dependency-ordered, one branch/PR each (01 shell+auth+PWA · 02 live queue · 03 services CRUD+Cal sync · 04 gallery+testimonials · 05 push notifications · 06 studio bookings · 07 client directory · 08 photo consent · 09 client voice & transparency). Read `00-context.md` first. **Admin design produced via Claude Design (July 2026)** — strong direction for all admin tasks. The rendered design reference is saved in-repo at [`design/Bella Nails Admin.html`](./design/Bella%20Nails%20Admin.html); import instructions + written spec in `00-context.md` ("Design source"). **Decided (July 2026): the admin is a mobile-first installable PWA with web-push new-booking alerts** — not Electron (desktop-only), not a store app (Capacitor wrappable later if ever wanted); interim alerting = webhook→Zoho email.

- 🔼 Owner-gated admin shell (Task 01, branch `feat/admin-shell`, July 2026) — built, pending owner prerequisites + review. **Admin is English-only and NOT locale-prefixed** (owner decision): it lives at **`/admin`** as its own root layout (`src/app/admin/`, no `[locale]`, no `SiteHeader`/`SiteFooter`), with a compact header + mobile bottom / desktop top tab bar (Queue · New · Clients · Services · More; only Queue live). Proxy gates `/admin*` to the owner and skips i18n; installable PWA (`app/manifest.ts` + `next/og`-generated icons, scope `/admin`); dashboard shows a real upcoming-booking count via an owner-reads-all RLS. **Blockers:** apply [supabase/admin-owner-reads.sql](../supabase/admin-owner-reads.sql) via Supabase MCP + set the Clerk session-token `metadata.role` claim / `publicMetadata.role = "owner"` (see [tasks/admin/01-shell-auth-pwa.md](./tasks/admin/01-shell-auth-pwa.md) "Owner prerequisites").
- 🔼 Manage services / add-ons / incompatibilities (soft-delete via `archived_at`) — **pulled forward, build right after `/book`**: one-step create/update/archive including the Cal event-type sync (see the Phase 6 "one event type per service" decision), so the owner rebuilds the placeholder catalog entirely from the admin without touching the Cal dashboard.
- ⬜ Manage gallery — Scaleway presigned-POST upload (store the object key), and expose homepage featuring through nullable `sort_order` slots `1..5` (not arbitrary full-gallery ordering). Non-featured gallery items should keep `sort_order = null`.
- ⬜ Manage testimonials — new `testimonials` table (see Phase 7) + CRUD; home section switches from i18n to reading it.
- ⬜ Booking queue / **schedule** (client component + Query + Realtime) — a **forward agenda grouped by week → day** so the artist can plan weeks ahead, not just see today. The **current week is expanded by default**; **future weeks are collapsible groups** (collapsed by default, header shows the week range + appointment count, "· open" when empty), rendered through the furthest upcoming booking so calendar gaps are visible. Studio TZ, weeks start Monday; realtime bookings drop into the right day/week (current-week cards slide in, collapsed weeks just bump their count). Past bookings stay out (history lives on client pages). A header **toggle switches Agenda ↔ a condensed month Calendar grid** (quiet per-day dot/count, month nav, tap-a-day → agenda) for a high-level plan-ahead glance — same data, no separate path; build Agenda first, Calendar toggle second. Spec: [tasks/admin/02-bookings-queue.md](./tasks/admin/02-bookings-queue.md), design brief §4 A.

### Studio-created bookings

Two paths, one identity model. Client PII (email/name) lives in **Clerk**; our tables store only the pseudonymous `clerk_user_id`, so the DB holds no personal data. Keystone helper: **create-or-find a Clerk user by email** (Clerk Backend API, passwordless — the client later signs in with an email code and sees their full history).

**A. Studio-created bookings — first-class admin feature (revised July 2026, spec: [tasks/admin/06-studio-bookings.md](./tasks/admin/06-studio-bookings.md)):**

- ⬜ The artist books on a client's behalf (email required; existing or new client via `ensureClerkUser`) from the admin PWA: catalog picker → `GET /v2/slots` → `POST /v2/bookings` with the standard metadata shape → existing sync/webhook pipeline persists. **Slot hard-blocks in Cal immediately.**
- ⬜ **Client approval is OUR state, not Cal's**: new columns `origin ('client'|'studio')` + `client_accepted_at` — the "accepted by client" toggle. Queue shows "awaiting reply" + proposal age (follow-up view); client can Confirm in-app on /bookings; artist can toggle manually after an email/DM yes. Covers: client reached out via email/social, and the in-studio "book your next session" moment after a treatment.
- ⬜ Same proposal→acceptance pattern is the foundation the deferred out-of-hours flow (B) reuses.

> **Booking status growth (decided July 2026):** the client-facing status set stays minimal — `confirmed|rescheduled|cancelled` in the DB plus the derived display-only "completed" on /bookings history. New statuses land WITH their features, not before: `requested`/`declined` arrive with the request flow below (Cal `BOOKING_REQUESTED`/`BOOKING_REJECTED` webhooks + `BOOKING_STATUS` enum + `BookingStatusBadge` variants), payment states arrive with Stripe holds, and no-show tracking stays **studio-side only** (admin queue — don't show "missed" to clients). The client's upcoming cards deliberately render no status badge at all.
>
> **No-show (decided July 2026):** stored as a separate `no_show_at` marker ([supabase/booking-no-show.sql](../supabase/booking-no-show.sql)), **not** a `status` value — `status` is the Cal-synced lifecycle, so a webhook could clobber a `status=no_show`, and a marker also keeps it invisible to clients. Owner marks it from the appointment card, **eligible only once `now >= start_time + 1h`** (covers past + long in-progress). Owner-verified action (service-role write, eligibility re-checked, toggle to undo). Earns no revenue in Task 10 unless an income override records a no-show fee. Spec: [tasks/admin/02-bookings-queue.md](./tasks/admin/02-bookings-queue.md).

**B. Out-of-hours requests (via `booking_requests`)** — for slots Cal.com availability won't offer (currently anything but Saturday). SQL: [supabase/booking-requests.sql](../supabase/booking-requests.sql). **Decided (July 2026): deferred until the admin pages exist** — the request queue is meaningless without the owner surface that answers it; until then the contact email/phone is the out-of-hours path.

- ⬜ New `booking_requests` table: `clerk_user_id`, `services` (jsonb snapshot), `est_duration_mins`, `est_price_cents`, `preferred_times`, `note`, `status` (`pending|accepted|declined|scheduled|cancelled|expired`), `booking_id` (→ `bookings.id`, set once scheduled), timestamps. RLS mirrors `bookings` (user reads/creates own via Clerk `sub`; admin transitions via service-role). Added to Realtime for the live admin queue.
- ⬜ Request form is **gated behind Clerk email-code auth** — captures a verified email in Clerk, removes the auto-create-user spam vector, and makes history automatic. Client picks service(s)/add-ons + proposed times + note; submits as `pending`.
- ⬜ Admin reviews requests in the queue, agrees a slot, creates the Cal.com booking (host-created, out-of-hours via API), links `booking_id`; status → `scheduled`. The confirmed booking still lands in `bookings` via the webhook, tied to the same `clerk_user_id`.

**Shared:** "My bookings" matches a client's rows by Clerk `sub` (covers both paths, since everything is keyed to a Clerk user). Both feed the admin Booking queue.

### Client directory — CRM-lite (added July 2026, spec: [tasks/admin/07-clients.md](./tasks/admin/07-clients.md))

- ⬜ `/admin/clients`: every client who ever booked (roster = distinct `clerk_user_id` from `bookings`; names/emails/phones fetched live from Clerk, never persisted — identity model unchanged). Search via Clerk's `query` param.
- ⬜ Client page: contact actions (`tel:` / `mailto:` — Zoho), full booking history (reuses the /bookings display shapes under owner-reads-all RLS), **artist notes** (timestamped, owner-only) and **private reference photos** of previous sets (Scaleway private objects via short-lived presigned GET, separate from the public gallery). "New booking" jumps into the Task 06 flow prefilled.
- ⬜ Two new tables in `supabase/clients.sql`: `client_notes` + `client_media` — keyed by `clerk_user_id`, **owner-only RLS both directions**, soft-delete. Migration before deploy; regenerate types.
- ⬜ Clerk-backed CRUD: edit name/phone via Backend API; email read-only in v1 (sign-in identity). **Delete = real GDPR erasure**: Clerk user + notes + media + Scaleway objects hard-deleted; pseudonymous booking rows kept as business records; blocked while upcoming bookings exist.
- ⬜ **Legal posture (answered in the brief):** viewing contact data outside a booking context is lawful (Art. 6(1)(b)/(f) — ongoing service relationship), with boundaries: no marketing use without consent, notes are disclosable on access request ("write as if the client will read it" caption in the UI), no health commentary beyond what the client volunteered (Art. 9), client photos stay private — the publication path is the consent flow below. Owner to add a privacy-policy paragraph covering client records.

### Photo publication consent (added July 2026, spec: [tasks/admin/08-photo-consent.md](./tasks/admin/08-photo-consent.md))

The bridge from private client photos (Task 07) to the public gallery/social. **Legal decisions settled with the owner:**

- ⬜ **License + recorded consent, NOT ToS ownership transfer** — an "uploads become ours" clause is unfair-terms bait and irrelevant (publishing an identifiable person for marketing needs a GDPR basis regardless of copyright); artist-taken session photos are her copyright already but carry the identical consent requirement. Consent can't be bundled into service terms (Art. 7(4)).
- ⬜ **Verbal yes in the chair = the trigger, never the record** (valid but undemonstrable, Art. 7(1)); the record is the client's one-tap Confirm on `/bookings`. No blanket "session data" consent email — private reference photos ride on legitimate interest + privacy policy; consent enters only at publication, per image, per purpose (website / social as separate un-preticked checkboxes).
- ⬜ Flow: artist taps "Request permission" on a photo → client sees the image + versioned localized terms on `/bookings` → grant copies the asset into the `public/` prefix (public-read ACL; private original untouched) + creates the `gallery_items` row; social grant = manual green light (posting pipeline stays dropped). **Withdrawal is one tap, forever visible** (Art. 7(3)): unpublishes the gallery copy immediately, social takedown reminder to the artist.
- ⬜ `supabase/photo-consent.sql`: `consent_terms` (versioned, append-only — the log must prove the exact text seen) + `media_publication_consents` audit log (media id, client, terms version, scopes requested/granted, status pending|granted|declined|withdrawn, timestamps, published asset + gallery item links). Owner-full/client-reads-own RLS; responses via RLS-verified server action. Client erasure (Task 07) withdraws/unpublishes first, then erases.
- ⬜ Prerequisite (owner): the plain-language terms text (da+en) for `consent_terms` v1.

### Client voice & transparency (added July 2026, spec: [tasks/admin/09-client-voice-transparency.md](./tasks/admin/09-client-voice-transparency.md))

Mostly client-facing, on the signed-in `/bookings` surface — which the website and the future client PWA share, so one build covers both endpoints.

- ⬜ **Client-submitted testimonials**: always-available "Share your experience" + prompt cards when the artist requests one ("How was your appointment on 12 Jul?", dismissible, `testimonial_requests` table). Client picks their credit (first name / initial / anonymous); the consent to be featured is the stated purpose at submission — no separate flow. Submissions land `pending`; the artist publishes/declines from the Task 04 testimonials screen (decline shows neutrally client-side, never as rejection). Artist edits to a client quote are marked "edited" — rewrite-worthy quotes get declined, not rewritten. ⚠️ Task 04's schema uses `status pending|published|declined` (not `is_published`) so both tasks share one truth; public RLS reads `published` only.
- ⬜ **"Photos of your nails"** (the deliberate RLS decision Task 07 reserved): client select-own on `client_media`, short-lived presigned GET URLs minted server-side. Every photo shows its plain-language state — Private ("only Veronica sees this") · Asked (answer the Task 08 request in place) · Shared (on our website / approved for social) · Withdrawn — and **withdrawal is self-service** on any shared photo (Task 08's action, no new machinery). Deleting private reference photos entirely stays a contact-the-studio line in v1.
- ⬜ **Artist notes stay non-visible client-side (recommendation, owner to confirm):** Art. 15 access-on-request + the privacy-policy mention already covers compliance; a live feed would make the artist write for the audience instead of for the next appointment. The section carries an honest one-liner ("Veronica keeps short service notes… want a copy? Write to hello@bellanails.dk"). Revisit if access requests actually arrive.

### Insights — financial & occupancy overview (added July 2026, spec: [tasks/admin/10-insights-financial-occupancy.md](./tasks/admin/10-insights-financial-occupancy.md))

An owner-only overview screen — **explicitly indicative, not accounting** (a big persistent "For information only — not an accounting or tax record" disclaimer, since it's derived from booking totals and ignores no-shows-charged, tips, refunds, fees, VAT).

- ⬜ **Monthly revenue** — Σ **effective income** of **completed** appointments (ended AND active — not cancelled, not future) per studio-TZ month, in DKK. Reuses the completed/active derivation + `groupBookingsByMonth`.
- ⬜ **Per-appointment income override** — since it's info-only, the artist can correct each appointment's income (refunds, no-show fees, tips) via a nullable `income_override_cents` column (never overwrites the booked `total_price_cents`); **effective income = `income_override_cents ?? total_price_cents`** (`??`, so a `0` = real zero). Owner-only inline edit on the expanded card; overridden rows get an "adjusted" marker.
- ⬜ **Occupancy %** — Σ appointment footprint ÷ available working minutes, so the artist sees whether time slots are used optimally. **Footprint = duration + the 30-min `afterEventBuffer`** (the real turnaround the calendar blocks). Realized from completed appointments; optionally a projected figure from upcoming.
- ⬜ ⚠️ **Prerequisite: define the studio's working hours** (occupancy's denominator). Today they live in Cal.com's availability schedule, not our DB — start by mirroring open days/hours into `config/studio.ts`; read Cal availability via API only if hours change often. Buffer is 30 min per event type (constant for now).
- ⬜ Owner-only, `noindex`; new screen (e.g. `/admin/overview`) linked from **More**. No client PII — amounts + times only.

Decisions / to verify:

- ⬜ **GDPR posture:** centralizing PII in Clerk shrinks our surface (DB is PII-free; erasure = delete the Clerk user, leaving only a dangling id) but does **not** remove controller obligations — ensure a Clerk DPA and a privacy-policy line.
- ⬜ **Clerk MAU:** confirm created-but-dormant users don't count toward the plan's MAU before relying on the free tier.
- ⬜ Deferred: full auto-recurring series. (Guest→account reconciliation is now moot — every client is a Clerk user from the first interaction.)

## Nice to have — explorations (not committed)

- ✅ **Social integration — DROPPED (owner, July 2026)**; inbox = Meta Business Suite (deep-link from admin shell), no posting pipeline (unused + stores post-only data the site never shows). Shipped instead: **Open Graph/Twitter sharing metadata + branded OG image** so client shares look right in social/messaging apps. Record: [tasks/explorations/social-integration.md](./tasks/explorations/social-integration.md).
- ⬜ **Client PWA** — installable client app: reminders, one-tap rebook, waitlist for cancellations, "my sets" photo history; coupons flagged as a brand decision (site copy currently promises no promotional pricing). Reuses the admin PWA plumbing (Phase 8 Task 05). Scoped in [tasks/explorations/client-pwa.md](./tasks/explorations/client-pwa.md) — validate install rate before investing past the cheap v1.

## Phase 9 — Hardening & launch

- ⬜ SEO/metadata per locale, sitemap, OG images. → see Phase 10 (Local SEO).
- ⬜ Error/loading boundaries, empty states, toasts.
- ✅ Verify the custom 404 / not-found page renders correctly for bad locale-prefixed routes and unknown slugs (done with the Phase 7 build — `/da|/en` unknown + nested slugs branded 404, `/fr/x` bad-locale → root fallback, real routes 200). Re-run once on the prod host before launch.
- ⬜ Final legal-content review for the published `Terms of Service` copy, guarantee wording, and all linked placements before launch.
- ⬜ Lighthouse / a11y pass; verify no booking-UI flicker.
- ⬜ Env wiring on host (Vercel free tier), webhook URLs pointed at prod, secrets set.
- ⬜ Smoke test full booking → webhook → DB → admin live update.
- 🔼 **Developer setup runbook** ([docs/SETUP.md](./SETUP.md)) — from-zero: prerequisites, every vendor account + exact settings + where each env var goes, DB bootstrap order, owner setup, run + deploy. Goal: **any dev can restart the project without AI.** Keep in sync when infra changes.
  - ⬜ Follow-up flagged by the runbook: **consolidate the DB schema** into one ordered `supabase/schema.sql` (today the base tables live only in the INFRASTRUCTURE.md SQL block, with `supabase/*.sql` as incremental patches — no single bootstrap script).

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
- ⬜ Hero image perf (`next/image` `priority`; assets pre-sized since Scaleway has no on-the-fly transforms) — Core Web Vitals.

**Off-page** (parallel — highest leverage):

- ⬜ Google Business Profile: claim, primary category "Nail salon", exact NAP, photos, services+prices, Cal.com link, regular posts.
- ⬜ Review engine: QR at checkout + post-visit SMS/email via Cal.com; respond to ≥80%.
- ⬜ Citations w/ consistent NAP: Krak, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places, Booksy.
- ⬜ Danish blog (1/mo) targeting long-tail → internal links to booking.
- ⬜ Local backlinks (Ørestad / Bella Center / Amager groups) + Instagram geotags & hashtags.

⚠️ Blocked on: public phone, final domain, geo coordinates, social URLs (for NAP + schema).
Measure: Search Console (Tier-1 query positions), GBP insights, local-pack rank for "neglesalon Ørestad".

## Phase 11 — In-house scheduling & identity (retire Cal.com + Clerk)

> **Decided (August 2026, owner):** bring scheduling and identity in-house. Cal.com and Clerk
> are removed; **Scaleway stays** (free EU object storage) and **Supabase stays** (see the
> platform decision below). This supersedes Phase 4's vendor choice and Phase 6's booking
> engine — the *domain* decisions in Phase 6 (add-on duration model, round-up rule, 24 h
> notice, 30-min buffer, metadata shape) all carry over unchanged; only the engine moves.
>
> Investigation brief (answer before writing code): [`tasks/in-house/00-investigation.md`](./tasks/in-house/00-investigation.md).

### Why (the honest reasons — recorded so they aren't re-litigated)

1. **Email ownership** — the real driver. Cal owns confirmation/reminder/cancel/reschedule
   emails today; they're off-brand, their timing isn't ours, and their manage-buttons point at
   `cal.eu` and are **not customizable on cloud** (already flagged in Phase 7's in-app manage
   note). Owning the send is the only fix.
2. **Shrinking the processor chain (GDPR).** Client PII lives in **Clerk (US)**, media in
   **Scaleway (EU)**, bookings in **Supabase (EU)** — so erasure is a three-vendor dance
   ([`lib/media-erasure.ts`](../src/lib/media-erasure.ts)) and one leg is a US transfer, while
   the rest of the stack was deliberately chosen EU-sovereign. With Task 07/08 (client records,
   photo consent) we are already a full controller of identifiable client data; consolidating
   PII into our own EU Postgres makes Art. 15 / 17 a single transaction instead of a
   cross-vendor orchestration.
3. **Cal.com is now a thin slice of a thick flow.** We already own service/add-on selection,
   totals, duration math, the request flow, no-show marking, reschedule tracking and the
   sync-first persist routine. Cal provides exactly four things: slot computation from
   availability, the double-booking guarantee, transactional emails, and the artist's calendar.
4. **Platform-margin insurance** (secondary, if this ever becomes a product): Cal.com's
   multi-tenant tier and Clerk's MAU pricing both scale with the *client's clients*. Removing
   them now removes a structural cost we'd otherwise inherit.

⚠️ **Not a reason: perceived lag.** The suspicion that Cal/Clerk cause the intermittent
slowness is unverified and probably wrong. Honest ranking of suspects: (a) **Scaleway media —
no CDN, no size variants**, one stored object served direct from `s3.fr-par` (Phase 7/10 both
note this; a gallery of phone photos is the likely dominant cost and it survives this
migration untouched); (b) the Cal **embed iframe** — a whole second app with its own JS/fonts,
real but confined to `/book`; (c) Clerk middleware on every request + provider bundle,
moderate; (d) our own RSC waterfalls / missing indices (Phase 3 deferred them) / free-tier cold
starts. **Do the measurement as its own task** — this migration must not be sold as a perf fix.

- ⬜ **Perf baseline before any of this** — record LCP/TTFB per route (`/`, `/services`,
  `/gallery`, `/book`) and the transferred bytes for gallery media. Then decide the CDN /
  image-variant work on its own merits. Without a baseline we can't tell whether the
  re-platform helped, hurt, or did nothing.

### What actually has to move (measured, August 2026)

**Cal.com — 42 references across 16 files. Contained.**

- DB: `services.cal_event_id` (**not null unique**), `bookings.cal_booking_id` (**not null
  unique**), `cal_uid`, `rescheduled_from_uid`, `reschedule_url`, `cancel_url`. All become
  ours or disappear → schema migration, not just a code change.
- Code: [`config/calcom.ts`](../src/config/calcom.ts), [`lib/cal-event-types.ts`](../src/lib/cal-event-types.ts),
  [`lib/cal-phone.ts`](../src/lib/cal-phone.ts), [`lib/booking-sync.ts`](../src/lib/booking-sync.ts),
  [`lib/booking-cancel.ts`](../src/lib/booking-cancel.ts), [`api/webhooks/cal`](../src/app/api/webhooks/cal/route.ts),
  `sections/cal-embed-shell.tsx`, `sections/booking-embed.tsx`, `admin/more` (dashboard deep-link),
  `admin/create-service-sheet.tsx` (event-type sync).

**Clerk — 250 references across 60 files. This is the big one, and not because of auth.**

- `clerk_user_id` is on **six tables**: `bookings`, `booking_requests`, `client_media`,
  `media_consents`, `client_consents`, `owner_notifications` — and it appears in the `using ()`
  clause of **every** user-scoped RLS policy ([rls.sql](../supabase/rls.sql),
  [media-and-consent.sql](../supabase/media-and-consent.sql), [booking-requests.sql](../supabase/booking-requests.sql)).
- [`lib/clerk/ensure-user.ts`](../src/lib/clerk/ensure-user.ts), [`contact.ts`](../src/lib/clerk/contact.ts),
  [`client-contacts.ts`](../src/lib/clerk/client-contacts.ts) mean **Clerk is our client CRM**,
  not just our auth: names, emails and phones live there and the admin client directory reads
  them live. So the work is *build a `clients` table → migrate PII → rewrite 60 files → then*
  swap auth. Auth is the small part.
- Also: `sign-in`/`sign-up`/`account` catch-all routes, the `/admin*` owner gate in
  [`proxy.ts`](../src/proxy.ts), `@clerk/localizations` (da/en), the `@clerk/ui` shadcn theme,
  and the Supabase **Third-Party Auth** wiring in both Supabase clients.

### Decided — what replaces what

**Scheduling (ours).** Two new tables: `availability_windows` (weekday + local start/end +
effective date range) and `availability_overrides` (closures, holidays, one-off open blocks).
Slots are generated **in `Europe/Copenhagen` then stored UTC** — never generated in UTC with
offsets added, which breaks on the two DST transitions. Extends the existing
[`lib/studio-time.ts`](../src/lib/studio-time.ts). Phase 6's rules carry over verbatim: 15-min
grid, base→base+max-addon duration range, **round up never down**, 24 h minimum notice, 30-min
after-buffer applied once per booking.

> ✅ **Side benefit:** this resolves the open prerequisite Task 10 (Insights) flagged — studio
> working hours currently live only in Cal's availability schedule, so occupancy % has no
> denominator. After this phase they're a first-class table.

**The double-booking guarantee = one Postgres constraint.** This is the single thing Cal was
really underwriting, and it belongs at the only layer that can honour it under concurrency:

```sql
create extension if not exists btree_gist;
alter table public.bookings add column if not exists period tstzrange
  generated always as (tstzrange(start_time, end_time, '[)')) stored;
-- the predicate must mirror lib/booking-status.ts:isActiveBookingStatus — one truth
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (period with &&) where (status <> 'cancelled' and status <> 'declined');
```

⚠️ The buffer is **not** in `end_time` (clients see 105 min, the calendar blocks 135). Decide
explicitly whether `period` spans the buffer — if it doesn't, the constraint permits
back-to-back bookings the artist can't actually work. Recommendation: add a stored
`blocked_period` covering duration + buffer and constrain on that.

**Booking identity (ours).** `bookings.id` (uuid) becomes the only identity; the six `cal_*`
columns drop. `cancel_url` / `reschedule_url` are replaced by **our own signed, expiring
tokens**, which also fixes the emailed-links-point-at-cal.eu problem for good. Existing
`/appointments/reschedule/[uid]` route shape can stay. The client's phone — currently collected
by Cal as a booking field ([`lib/cal-phone.ts`](../src/lib/cal-phone.ts)) — moves onto our own
booking form and the `clients` table.

**The artist's calendar is the load-bearing loss.** Phase 6 recorded that the **Cal.com
dashboard IS the artist's booking calendar** (Zoho sync was skipped). Removing Cal leaves her
with no day/week view. Therefore: **Phase 8 Task 02** (agenda grouped by week → day, + the
month-grid toggle) is promoted from a queue nicety to a **hard prerequisite of the Cal
cutover** and must ship and be lived-in *before* the switch. Expect this to be the largest
single chunk of the phase — it's UI work, not scheduling logic.

**Identity (Supabase Auth — not hand-rolled, not another vendor).** Same project, same EU
region, and `auth.uid()` works natively in RLS, which retires the Third-Party-Auth / JWT
indirection entirely. New `clients` table (`id uuid` = `auth.users.id`, email, name, phone,
timestamps).

- ⚠️ **This reverses the Phase 3 locked decision "clients keyed to Clerk, no PII in our DB."**
  Deliberate: with Task 07 notes and Task 08 photo consent we hold identifiable client data
  anyway, so the PII-free-DB posture bought pseudonymity on one table while costing a
  cross-vendor erasure path. Recorded here so the reversal is a decision, not a drift.
- RLS rewrite on six tables: `(select auth.jwt() ->> 'sub') = clerk_user_id` → `auth.uid() =
  client_id`. Owner-reads-all moves from a Clerk metadata role claim to an `owner` flag /
  `is_owner()` SQL function.
- **Passwordless (email code / magic link) for clients; password for the owner only.** This
  eliminates password-reset flows, session-hash migration, and most of the account portal we'd
  otherwise rebuild to replace `[locale]/account/[[...rest]]`. It also matches what
  `ensureClerkUser` already does (create-or-find, passwordless) — so the *behaviour* is
  unchanged, only the provider.
- ⬜ **Verify before committing:** whether Clerk exports password hashes. If not, existing
  clients need re-onboarding — trivial at current volume, but it must be a planned step, not a
  launch-day surprise. Passwordless sidesteps it entirely.

**Email (ours — build this first).** **ZeptoMail** (Zoho's transactional product, EU DC) —
stays inside the adopted vendor stack, over Resend/Postmark/SES. Plus a `scheduled_emails`
table drained by a **Vercel Cron** job using `for update skip locked`, with a unique
`(booking_id, kind)` for idempotency. Reminders need this machinery regardless — Cal was doing
them. Stages to cover: confirmation, reminder(s), cancellation, reschedule, request
accept/decline (Phase 8 B), photo-consent requests (Task 08), and auth codes.

> This **supersedes** the open Phase 6 item "Branded transactional emails for every stage" —
> the Cal Workflows option is dropped, we send our own.

**Stripe loose end.** Phase 6 routes no-show card holds *through* Cal.com ("can be enabled
later with zero app changes"). That is no longer true: after this phase, holds mean **our own
Stripe SetupIntents**. Still deferred (owner undecided), but re-scope it before promising it.

### Platform: stay on Supabase (decided August 2026 — don't revisit without a named trigger)

Owner asked whether AWS would be better/cheaper on paid tiers. Answer: no, at this scale.

- **Cost.** Supabase Pro (~$25/mo) bundles Postgres + Auth + Storage + Realtime + REST +
  dashboard. AWS equivalent: RDS `t4g.micro` ~$12–15 plus storage and backups (or Aurora
  Serverless v2 at ~$40+/mo *idling*), plus Cognito, plus ~$32/mo for a NAT gateway the moment
  anything goes VPC-private. AWS wins at large scale with reserved capacity and an operator —
  neither applies.
- **Support.** AWS support is a paid add-on (Developer ≈ $29/mo, business-hours email, no
  meaningful SLA; Business starts ~$100/mo). The premise that AWS support is better for a solo
  developer is backwards.
- **Sovereignty.** AWS is also a US company — moving there improves the GDPR story by zero.
  Supabase on an EU region with a DPA + SCCs is the standard defensible posture. If sovereignty
  ever becomes a hard requirement, the consistent move is **Scaleway Managed Postgres** (EU,
  account already exists, ~€10–15/mo) — but that means rebuilding Auth, Realtime and the
  storage API ourselves. Given Realtime already backs the admin live queue, don't.
- **AWS gives primitives, not a product.** This phase is already replacing two vendors; adding
  a third rebuild is how it never ships.
- ⬜ **Do verify** the Supabase project is in an **EU region**. If it landed in `us-east-1`
  that undercuts the whole sovereignty argument and should be fixed regardless of this phase.
- **Revisit trigger:** a *named* Postgres limitation we've hit, or a contractual sovereignty
  requirement. Not "AWS might be cheaper."

### Migration order — strict, and not concurrent

Each step is independently shippable and independently revertible. Do not overlap them.

1. ⬜ **Email infrastructure, additive.** ZeptoMail + `scheduled_emails` + Cron + branded
   localized templates, while Cal still runs everything. Zero risk: nothing depends on it yet.
2. ⬜ **Switch Cal's own emails off; send ours from the existing webhook.** Cal still owns
   booking. This proves the email layer under real traffic with a one-line rollback, and it
   delivers the owner's actual complaint *before* the risky work starts.
3. ⬜ **Artist calendar (Phase 8 Task 02) shipped and lived-in.** Prerequisite, above.
4. ⬜ **Scheduling engine behind a flag → cut over → delete Cal.com.** Own availability +
   slots + overlap constraint + signed manage tokens + booking form (incl. phone). Run both
   engines read-only in parallel for a week and diff offered slots before flipping.
5. ⬜ **`clients` table + PII migration off Clerk**, then **Supabase Auth swap** (passwordless
   clients, owner password, RLS rewrite on six tables, `owner` flag). Last, because it has the
   highest blast radius and is the least likely cause of anything currently felt.

⚠️ Phase 6's **end-to-end test scenario** and Phase 7's in-app-manage hardening list are both
written against Cal semantics — both need rewriting as part of step 4, not after.

### What gets worse (accept knowingly)

- **We own auth security**: session rotation and revocation, rate limiting, lockout, signup
  abuse, account enumeration, breach detection. The legal chain gets simpler; the engineering
  responsibility grows. Not a pure win.
- **We own scheduling correctness**: DST, overlap under concurrency, buffer arithmetic. The
  exclusion constraint covers the scariest case; the rest is tests.
- **We own deliverability**: SPF/DKIM/DMARC on the sending domain, bounce/complaint handling.
- **No vendor to blame at 09:00 on a Saturday.**

### Open questions for the owner

- ⬜ Are clients ever expected to sign in with **Google/Apple**, or is email-code enough
  forever? (Passwordless-only is materially less work; adding OAuth later is easy.)
- ⬜ Should the artist's calendar ever sync **out** to a phone calendar (ICS feed / Google)?
  Cal was the de-facto answer; if yes, a read-only signed ICS feed is the cheap version.
- ⬜ Any appetite for a **waitlist / cancellation backfill** once we own slots? (Cheap once the
  engine is ours; listed in the client-PWA exploration.)

- ⬜ **TASK: investigate solution implementation** → [`tasks/in-house/00-investigation.md`](./tasks/in-house/00-investigation.md).
  Nothing above is a build instruction yet. The brief defines the spikes, the questions that
  must be answered with code or vendor docs (not assumption), and the go/no-go per step.

---

## Critical-path dependencies

```
Design system ─▶ i18n/routes ─▶ Supabase schema ─▶ Auth ─▶ Query+Realtime ─┐
                                                                            ▼
                                              Booking (Cal.com+Stripe) ─▶ Public + Admin features
```

Auth must land before RLS-protected Realtime is meaningful; schema before any data feature;
i18n route structure before features so pages are born localized.

**Phase 11 re-platform (Cal.com + Clerk out)** — strictly sequential, each step revertible:

```
Email infra ─▶ our emails (Cal still books) ─▶ artist calendar (Task 02) ─▶ own scheduling ─▶ clients+Supabase Auth
   additive        owner's actual complaint       prerequisite: replaces      delete Cal.com      biggest blast
   zero risk       solved before risky work        the Cal dashboard                              radius → last
```

The artist calendar is the true gate: Cal's dashboard is currently her only day/week view, so
the cutover cannot precede its replacement. Identity moves last because it touches six tables'
RLS and 60 files, and is the least likely cause of any problem felt today.
