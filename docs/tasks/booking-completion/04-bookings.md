# Task 04 — /bookings (My bookings)

> Read [`00-context.md`](./00-context.md) first.

## Goal

The auth-gated page where a signed-in client sees their upcoming and past
appointments and manages them (reschedule / cancel) via the Cal.com URLs stored
on each `bookings` row.

## Depends on

Task 02 (rows exist, keyed to `clerk_user_id`). Auth (Clerk + RLS) is already
in place.

## In scope

- New `src/app/[locale]/bookings/page.tsx` (canonical pattern) + `src/components/sections/my-bookings.tsx`.
- **Auth gate:** signed-out users redirect to the localized sign-in (`routes.signIn`) and back. (The nav link already exists in `headerNav`.)
- Read `bookings` via `createAuthedSupabaseServerClient()` — RLS *"Users read own bookings"* (`auth.jwt()->>'sub' = clerk_user_id`) already scopes to the current user. Covers both self-booked and studio-created bookings.
- `PageHeader` (eyebrow + editorial heading, e.g. *"Your appointments"*).
- **Upcoming** section: cards — service (+ add-ons from `selected_addons`), date/time (localized), duration, total (`PriceTag`), status `Badge`, **Reschedule** / **Cancel** actions linking out to `reschedule_url` / `cancel_url`.
- **Past** section: condensed rows; optional "Book again" deep-linking `routes.book` + `?service=<uuid>`.
- **Empty state:** editorial "No appointments yet" + CTA to `routes.services` / `routes.book`.
- Within-24h: reschedule/cancel are blocked by policy — render **disabled with a reason** (not just fail at Cal). Compute from `start_time`.
- Localized dates/times (`da`/`en`).
- i18n: new `bookings.*` namespace in `da.json` + `en.json` (incl. `metaTitle`/`metaDescription`, `noindex`).

## Out of scope

- Realtime live updates — **ship server-rendered first**. TanStack Query + Realtime (Phase 5) can layer on later without changing the read model.
- Embedding the reschedule/cancel UI — **link out** to Cal's hosted pages for MVP.
- The out-of-hours `booking_requests` view (Phase 8).

## Acceptance criteria

- Signed-out visit to `/da/bookings` redirects to sign-in, then returns after auth.
- A signed-in client sees only their own rows (verify RLS: a second user sees a different set).
- Upcoming vs. past split is correct; times/prices localized.
- Reschedule/Cancel open the correct stored Cal URLs; within-24h actions are visibly disabled with a reason.
- Empty state renders for a user with no bookings.

## Verification

- Two-account check (RLS isolation).
- E2E scenario step 8 (lifecycle: reschedule → cancel updates status — the row update comes from Task 02's webhook; this page just reflects it on reload).
- `pnpm lint` + `pnpm build` green.

## Relevant skills

`clerk-nextjs-patterns/references/server-vs-client.md` + `references/caching-auth.md` (server-side auth read, dynamic rendering). Supabase authed client usage in `src/lib/supabase/server.ts`.
