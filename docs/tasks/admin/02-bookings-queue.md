# Task 02 — Bookings queue (live)

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01.

## Goal

The artist's working view: today and upcoming bookings across ALL clients,
live-updating, with enough detail to prepare for each session and the power
to cancel on a client's behalf.

## In scope

- `/admin` (or `/admin/queue`) — mobile-first card list, grouped **Today /
  Tomorrow / Later**, soonest first: time range, service + add-ons, client
  name, duration, total, `BookingStatusBadge` (here "rescheduled" DOES
  matter — studio-side info), client note prominently (allergies etc.).
- **Client contact per booking**: resolve `clerk_user_id` → name/email/phone
  via the Clerk Backend API (batched `getUserList`), rendered with `tel:` /
  `mailto:` links. Never persisted to our DB (no-PII rule).
- **Realtime** (the Phase 5 wiring, admin half): `postgres_changes`
  subscription on `bookings` through the browser client (owner RLS applies)
  → `invalidateQueries`/refresh so a new booking appears without reload.
  This is TanStack's second real consumer — `useQuery` for the list is
  appropriate here (unlike the client's server-rendered /bookings).
- **Owner cancel**: reuse the cancel machinery with an owner-side server
  action (role re-checked; no 24 h policy for the owner) + confirm dialog.
  Reschedule-on-behalf links out to Cal's dashboard for now (owner is
  logged into Cal anyway) — in-app owner reschedule can come later.
- History view (past bookings, simple list, search by client name later).

## Out of scope

- Push notifications (05) — but structure the queue so 05 can deep-link to
  a booking card.
- The out-of-hours `booking_requests` queue — arrives WITH the request flow
  (statuses `requested`/`declined` extend `BOOKING_STATUS` then, per PLAN).

## Acceptance criteria

- Two-browser test: booking made on the client site appears in the open
  queue within seconds (webhook/sync → realtime), no reload.
- Client contact renders from Clerk; nothing PII lands in Supabase.
- Owner cancel updates Cal + our row + the client's /bookings view.
- Non-owner cannot read the queue (RLS verified, not just UI).
