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
