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
- ⬜ One Realtime hook on `bookings` → `invalidateQueries`; verify two-browser live update. Booker side stays RLS-safe (authed `postgres_changes` on own rows); the same plumbing later powers the admin live queue and can upgrade the confirm step's post-booking probe to a uid-scoped broadcast channel (see the securing hold in `booking-embed.tsx` — the wait is the UX, the transport is swappable in `waitForBookingRow`).
- ⬜ (Later) shadcn data-table for the admin queue.

## Phase 6 — Booking flow (Cal.com + Stripe)

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
- ✅ (copy shipped on the confirm step — ⚠️ the `/terms` PAGE itself still 404s) Add booking consent copy linking to `/[locale]/terms` anywhere users submit or confirm a reservation (embed wrapper, booking CTA area, confirmation screen as needed).
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
- ⬜ **Branded transactional emails for every stage** — Cal's default emails are generic and off-brand. Cover: booking confirmation, reminder(s) before the appointment, cancellation, and reschedule. Options to evaluate: Cal **Workflows** (built-in email reminders/templates — check EU-instance availability and customisation limits) vs. sending our own branded emails from the webhook (we already receive every lifecycle event) via Zoho's SMTP/API to stay within the adopted vendor stack. Decide per-stage: reminders may be fine in Cal; confirmation/cancellation likely want the branded route.

## Phase 7 — Public site features 🔼

- 🔼 **Home page built to the Figma comp** as responsive, localized (da/en) sections in `src/components/sections/` — one branch each (`bellaNails-home-*`): Hero, ServicesPreview, Formula, Differentiators, StudioGallery, Testimonials, FindUs (+ header/footer revamp). All use the design system (typography, tokens, Container/Section). Stacked branches off `main`; assembled in `[locale]/page.tsx`. Verified: both locales 200 with all sections.
  - ✅ Home / hero (Quiet Luxury landing) — full-bleed, editorial headline, Reserve CTA, scroll cue.
  - ✅ "The Formula" section — Didier Lab positioning (HEMA-free · vegan · cruelty-free · fiberglass-reinforced · Vitamin E + calcium), personal first-person framing.
  - ✅ **ServicesPreview** reads featured `services` from Supabase (localized, PriceTag).
  - ✅ **Full Services menu page** (`/services`, PR #17, July 2026) — "The Menu / Treatments & Care": data-driven category sections (`categories` + embedded `services`, ordered by `sort_order`; catalog restructured into Classic Manicure / Shellac & BIAB / Gel Extensions via [supabase/categories-menu.sql](../supabase/categories-menu.sql)), hoverable service rows deep-linking `/book?service=<uuid>`, SEO keyword intro copy (per [seo-plan.md](./seo-plan.md) Tier 2/3) + localized keyworded image alts, pricing/policy fine-print close. Also fixed the site-wide invisible `Separator` (classes targeted `data-horizontal`; base-ui emits `data-orientation`). Category images reuse the hero placeholder until Cloudinary photos land. Add-ons not shown on the menu yet — decide presentation with `/book`.
  - 🔼 Gallery (`gallery_items`: portfolio + before/after; Cloudinary `q_auto,f_auto`) — home StudioGallery now reads DB-backed items; next step is replacing temporary reused imagery with curated live assets and finishing the full gallery page/admin flow.
  - 🔼 **Testimonials** — copy currently lives in i18n (da/en), fine for launch. Decision: move to a `testimonials` table (mirrors services/gallery: `quote_en/_dk`, `author_name`, `author_role_en/_dk`, `sort_order`, `is_published`, `archived_at`; public read via RLS) so the owner can manage them — build it with the admin (Phase 8). Note: real client quotes are given in one language, so consider storing as-given rather than translating.
  - ⬜ Follow-ups: real photos via Cloudinary (hero + gallery), real map embed on FindUs, and the flaky-locale-switch Clerk re-init (deferred to Phase 9).
  - ⬜ Footer visual differentiation pass: explore an Onyx background treatment (or similar stronger contrast move) once the final footer content settles.
- ✅ "My bookings" (July 2026) — protected page (proxy auth gate, locale-aware sign-in redirect), RLS-scoped list: upcoming cards (countdown, add-ons, stored total, 24 h policy lock) + history (cancelled/completed, "book again" deep link with add-ons preselected). Home page gets a signed-in "next appointment" band.
- ✅ **In-app cancel & reschedule (July 2026)** — no Cal-hosted pages in the client flow: cancel = confirm dialog → server action → Cal API v2 (`CALCOM_API_KEY`) → row mirrored + revalidated; reschedule = `/bookings/reschedule/[uid]` (ownership via RLS read, eligibility re-checked) hosting the themed Cal embed's reschedule view → webhook probe → back to /bookings. ⚠️ Cal's own confirmation-email buttons still point at cal.eu (not customizable on cloud) — mitigated by a "manage your booking" line in the booking notes; fully fixed by the branded-email phase.

### In-app manage hardening — DO BEFORE Phase 8 admin (senior review, July 2026)

Findings from the code review of the cancel/reschedule/notes batch. The admin
queue builds on the same action/eligibility/webhook machinery, so harden first.

**Correctness (blockers):**
- ✅ (migration applied to live DB July 16) **Deploy order:** run [supabase/booking-client-notes.sql](../supabase/booking-client-notes.sql) BEFORE deploying — the webhook writes `client_notes` unconditionally; code-before-migration 500s **all** booking persistence, not just notes.
- ⬜ `cancelBooking`: wrap the Cal API fetch in try/catch — a transport failure currently throws out of the action (error boundary eats /bookings mid-dialog) instead of returning `{ok:false}`.
- ⬜ `cancelBooking`: treat Cal's "already cancelled" 4xx as success → mirror row + revalidate — otherwise a ghost booking (missed cancel webhook) can never be healed in-app.
- ⬜ `cancelBooking`: the `status === cancelled` early return must still `revalidatePath` (stale card stays rendered after an out-of-band cancel).
- ✅ **Live-verified July 16:** the `reschedule/<uid>` embed path renders Cal's reschedule view correctly and metadata carries to the new booking. ⚠️ Root-caused en route: reschedules fire `rescheduleBookingSuccessfulV2`, NOT `bookingSuccessfulV2` — the embeds listen for different events (note for the shell extraction). Original concern: `calLink="reschedule/<uid>"` is not Cal's documented embed pattern (embed.js allowlists `rescheduleUid`/`bookingUid` as config params on an event link). Keep a visible external `reschedule_url` link on the reschedule page until live-verified; try `config.rescheduleUid` on the event link as the documented alternative if the path form breaks. Also live-verify metadata carries to the rescheduled booking via the embed path (confirmed once via Cal-hosted reschedule).
- ⬜ Cancel dialog: gate `onOpenChange` on `pending` (Esc currently escapes the "stays open while pending" contract) and map error codes to distinct toasts — `within_policy` must say "contact the studio", not "try again" (also un-deadens the `CancelResult` union).

- ✅ **Webhook latency: measured ~58 s clean delivery (no failures) — Cal's queue, not our handler.** Fixed by **sync-first**: `lib/booking-sync.ts` owns the ONE persist routine; the webhook maps onto it (push/reconciler) and `syncBookingFromCal(uid)` pulls the authoritative booking from Cal API v2 the moment either embed reports success (server action, uid-capability-guarded, probe fallback). Client lands on fresh data in ~1 s regardless of queue mood. Also: shared `CAL_UID_PATTERN` now guards recap API + cancel + sync; webhook logs every receipt for delivery-timing visibility. Verified from the API payload: metadata (incl. clientNotes) survives reschedules; 115-min treatment correctly blocked 120-min slot.

**Structure (pay down before admin builds on it):**
- ⬜ One `canManageBooking(row, now)` in `lib/booking-display` — the eligibility rule is currently spelled 4 ways (card, cancel action, reschedule page, isUpcoming); `cancelBooking` skips `isActiveBookingStatus`, so future `requested/declined` statuses would be cancellable.
- ⬜ Extract the shared Cal embed shell (theme block, listener on/off wiring, skeleton, securing overlay) — booking-embed and reschedule-embed duplicate ~70 lines incl. the listener-stacking fix.
- ⬜ `SITE_URL` const in `src/config/` (trailing-slash-normalized) — the fallback is duplicated in layout metadata + the emailed manage line, where a wrong origin is unregenerable. Fixes the `//` double-slash risk.
- ⬜ Reschedule page: move UI into `sections/` (page not thin), let `routes` own the `/reschedule/` sub-path, drop the baked "– Bella Nails" from `rescheduleMetaTitle` (layout template appends the brand → currently doubles), add `rescheduleMetaDescription`.
- ⬜ Webhook docblock says "the single write path into bookings" — no longer true (cancel action mirrors status); either route both writers through a tiny shared bookings-writer or fix the claim.
- ⬜ **Rate-limit the unauthenticated `syncBooking` action** — it's an unmetered proxy to the Cal API key (junk-uid loops could 429 the key and break cancel/sync for real clients). Per-IP throttle or short-window per-uid dedupe; do before Phase 8 leans on the action.
- ⬜ Minor: surrogate-safe truncation for `clientNotes` (`[...notes].slice(0,500)`); ineligible-reschedule bounce is silent — carry a notice back to /bookings; `.env.example`: document `CALCOM_API_KEY` as required for in-app cancel + sync. (Done: shared `CAL_UID_PATTERN` guards recap API + cancel + sync + tightened to 12+ chars; persist path is resurrection-proof and heals failed old-row closes — replay-verified.)
- ⬜ Add a branded localized 404 / not-found page with clear recovery actions (home, services, booking).
- ⬜ Add localized `Terms of Service` page at `/[locale]/terms` with final studio booking, cancellation, lateness, no-show, payment, and studio guarantee terms.
- ⬜ Surface `Terms of Service` in the footer, around booking entry points, and on post-booking/confirmation surfaces where consent or reference is useful.

## Phase 8 — Admin

- ⬜ Owner-gated `/[locale]/admin` shell.
- 🔼 Manage services / add-ons / incompatibilities (soft-delete via `archived_at`) — **pulled forward, build right after `/book`**: one-step create/update/archive including the Cal event-type sync (see the Phase 6 "one event type per service" decision), so the owner rebuilds the placeholder catalog entirely from the admin without touching the Cal dashboard.
- ⬜ Manage gallery — Cloudinary signed client upload, store URL only, and expose homepage featuring through nullable `sort_order` slots `1..5` (not arbitrary full-gallery ordering). Non-featured gallery items should keep `sort_order = null`.
- ⬜ Manage testimonials — new `testimonials` table (see Phase 7) + CRUD; home section switches from i18n to reading it.
- ⬜ Booking queue (client component + Query + Realtime).

### Studio-created bookings

Two paths, one identity model. Client PII (email/name) lives in **Clerk**; our tables store only the pseudonymous `clerk_user_id`, so the DB holds no personal data. Keystone helper: **create-or-find a Clerk user by email** (Clerk Backend API, passwordless — the client later signs in with an email code and sees their full history).

**A. In-hours bookings (via Cal.com)** — within normal availability (Saturday):

- ⬜ The artist creates a booking for a client (existing or new) by email in the Cal.com dashboard; it arrives via the existing `BOOKING_CREATED` webhook and syncs to `bookings` through the Phase 6 pipeline. No custom flow.
- ⬜ Webhook maps the attendee email → Clerk user via create-or-find and stores `clerk_user_id`. `bookings` needs no schema change (Cal.com populates `cal_booking_id` / `cancel_url` / `reschedule_url`).
- ⬜ (Optional, later) an in-admin "New booking" shortcut calling `POST /v2/bookings` on the studio event type — same data path, still availability-bound.

> **Booking status growth (decided July 2026):** the client-facing status set stays minimal — `confirmed|rescheduled|cancelled` in the DB plus the derived display-only "completed" on /bookings history. New statuses land WITH their features, not before: `requested`/`declined` arrive with the request flow below (Cal `BOOKING_REQUESTED`/`BOOKING_REJECTED` webhooks + `BOOKING_STATUS` enum + `BookingStatusBadge` variants), payment states arrive with Stripe holds, and no-show tracking stays **studio-side only** (admin queue — don't show "missed" to clients). The client's upcoming cards deliberately render no status badge at all.

**B. Out-of-hours requests (via `booking_requests`)** — for slots Cal.com availability won't offer (currently anything but Saturday). SQL: [supabase/booking-requests.sql](../supabase/booking-requests.sql).

- ⬜ New `booking_requests` table: `clerk_user_id`, `services` (jsonb snapshot), `est_duration_mins`, `est_price_cents`, `preferred_times`, `note`, `status` (`pending|accepted|declined|scheduled|cancelled|expired`), `booking_id` (→ `bookings.id`, set once scheduled), timestamps. RLS mirrors `bookings` (user reads/creates own via Clerk `sub`; admin transitions via service-role). Added to Realtime for the live admin queue.
- ⬜ Request form is **gated behind Clerk email-code auth** — captures a verified email in Clerk, removes the auto-create-user spam vector, and makes history automatic. Client picks service(s)/add-ons + proposed times + note; submits as `pending`.
- ⬜ Admin reviews requests in the queue, agrees a slot, creates the Cal.com booking (host-created, out-of-hours via API), links `booking_id`; status → `scheduled`. The confirmed booking still lands in `bookings` via the webhook, tied to the same `clerk_user_id`.

**Shared:** "My bookings" matches a client's rows by Clerk `sub` (covers both paths, since everything is keyed to a Clerk user). Both feed the admin Booking queue.

Decisions / to verify:

- ⬜ **GDPR posture:** centralizing PII in Clerk shrinks our surface (DB is PII-free; erasure = delete the Clerk user, leaving only a dangling id) but does **not** remove controller obligations — ensure a Clerk DPA and a privacy-policy line.
- ⬜ **Clerk MAU:** confirm created-but-dormant users don't count toward the plan's MAU before relying on the free tier.
- ⬜ Deferred: full auto-recurring series. (Guest→account reconciliation is now moot — every client is a Clerk user from the first interaction.)

## Phase 9 — Hardening & launch

- ⬜ SEO/metadata per locale, sitemap, OG images. → see Phase 10 (Local SEO).
- ⬜ Error/loading boundaries, empty states, toasts.
- ⬜ Verify the custom 404 / not-found page renders correctly for bad locale-prefixed routes and unknown slugs.
- ⬜ Final legal-content review for the published `Terms of Service` copy, guarantee wording, and all linked placements before launch.
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
