# Task 01 — Admin shell, owner auth, PWA

> Read [`00-context.md`](./00-context.md) first.

## Goal

`/[locale]/admin` exists, only the owner can enter it, it installs to a
phone home screen as the Bella Nails admin app, and it has the nav shell the
other admin tasks plug into.

## In scope

- **Owner gate in the proxy**: extend the `/admin` matcher handling — after
  `auth.protect()`, check the session claim for `publicMetadata.role ===
  "owner"`; non-owners get a localized 404/redirect home (don't advertise
  the route exists). Configure Clerk session token to include the role claim
  if it isn't by default.
- **Owner-reads-all RLS** on `bookings` (new SQL file in `supabase/`):
  `select` for `authenticated` where the JWT role claim is `owner` — additive
  to the existing user-reads-own policy. Verify a non-owner still sees only
  their rows.
- **Admin layout** (`src/app/[locale]/admin/layout.tsx`): compact header
  (wordmark + section tabs: Queue / Services / Gallery), mobile-first —
  bottom tab bar on small screens is acceptable if it reads better.
- **PWA**: web app manifest (name, icons from the brand mark, standalone
  display, theme colors from tokens), served for admin use; installability
  verified on iOS Safari and Android Chrome. No offline caching yet (the
  admin is live data — a service worker ships with Task 05 for push).
- Placeholder dashboard page: today's date, count of upcoming bookings
  (authed read via the new policy) — proves the whole chain.
- i18n: new `admin.*` namespace (both files). `noindex` on everything.

## Out of scope

- The queue itself (02), any CRUD (03/04), push (05).

## Acceptance criteria

- Signed-out → sign-in → back. Signed-in non-owner → cannot see `/admin`.
  Owner → dashboard renders with a real booking count.
- "Add to Home Screen" on an iPhone yields a standalone app with the brand
  icon that opens straight into `/admin`.
- `pnpm lint` + `pnpm build` green.

## Refined implementation plan (July 2026)

Decisions taken after reading the code + design file, **plus the owner ruling
(July 2026): the admin is English-only, no locale prefix, and has no footer.**
This supersedes the draft above where noted (esp. the `/[locale]/admin` path
and the `admin.*` i18n namespace).

- **Admin lives OUTSIDE `[locale]` as its own root** (`src/app/admin/`), not
  under `[locale]/admin`. `[locale]/layout.tsx` stays untouched — no `(site)`
  refactor, no moved marketing files. Next 16 supports **multiple root
  layouts** (the app already relies on this: `[locale]/layout.tsx` is a root
  layout with no `app/layout.tsx`), so `admin/layout.tsx` is a second root
  with its own `<html lang="en">` + providers. Crossing between site and
  admin is a full page load — fine, they're separate apps.
- **No locale, no footer, English hardcoded.** No `admin.*` messages
  namespace; admin copy is plain English constants (single-language internal
  tool). No `SiteHeader`/`SiteFooter` — the admin renders its own compact
  header + bottom tab bar, nothing else.
- **Proxy:** `/admin` must skip next-intl (else `localePrefix:'always'`
  rewrites `/admin` → `/da/admin`). In `src/proxy.ts`, handle `/admin*`
  **before** `handleI18nRouting`: `await auth()`; signed-out →
  `redirectToSignIn`; signed-in non-owner → redirect to `/`; owner →
  `NextResponse.next()`. Remove `/admin` from the locale-prefixed
  `isProtectedRoute` matcher. Owner role read from `sessionClaims` (requires
  the Clerk **session token** to expose `metadata.role`/`publicMetadata.role`
  — owner dashboard step below).
- **Tabs = design brief §3.** Tab set is **Queue · New · Clients · Services ·
  More** (the design file confirms this IA). Task 01 wires the bar; only
  **Queue** routes to the placeholder dashboard (`/admin`). The other four
  render a shared in-shell "coming soon" placeholder so the shell is
  installable + navigable now. Bottom tab bar on mobile, top tabs ≥768px.
- **RLS:** new `supabase/admin-owner-reads.sql` — additive `select` policy on
  `bookings` for `authenticated` where the JWT role claim = `owner`. Written
  here; **applied to the live DB via Supabase MCP** (owner action — the MCP
  isn't authenticated in the build session). Until applied, the dashboard
  count is scoped to the owner's own bookings (harmless).
- **PWA:** `src/app/manifest.ts` (`MetadataRoute.Manifest`) at the app root —
  "Bella Nails Studio", `display: "standalone"`, `start_url`/`scope`
  `/admin`, `background_color`/`theme_color` `#fbfbfa`. Icons are generated as
  real PNGs via `next/og` `ImageResponse` (no converter needed): an onyx
  monogram tile. `app/icons/[name]/route.tsx` serves 192/512/maskable
  (dot-suffixed URLs so the proxy matcher skips them); `app/apple-icon.tsx`
  covers the iOS home-screen icon; `appleWebApp` meta on the admin layout.
- **Dashboard read:** `createAuthedSupabaseServerClient()` + count `bookings`
  where `status ∈ ACTIVE_BOOKING_STATUSES` and `start_time > now`.
- **Branch:** `feat/admin-shell` (one PR for Task 01).

## Owner prerequisites (blockers for full verification)

These can't be done from the build session — flagged so acceptance isn't
falsely marked complete:

- [ ] Clerk dashboard: ensure the **session token** carries the owner role
      (custom claim `role` or `publicMetadata.role`) and set
      `publicMetadata.role = "owner"` on the artist's + owner's users.
- [ ] Apply `supabase/admin-owner-reads.sql` to the live DB (Supabase MCP)
      and regenerate `src/lib/supabase/types.ts` if needed.
- [ ] Provide/confirm PNG app icons if the SVG→PNG generation can't run in
      the build environment.
