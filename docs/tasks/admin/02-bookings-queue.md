# Task 02 — Bookings queue (live)

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01.

## Goal

The artist's working view **and planning surface**: today plus every upcoming
booking across ALL clients as a forward agenda she can scan weeks ahead,
live-updating, with enough detail to prepare for each session and the power to
cancel on a client's behalf.

## In scope

- `/admin` (or `/admin/queue`) — mobile-first **forward agenda**, grouped by
  **week → day**, soonest first (studio TZ, weeks start Monday). Each card:
  time range, service + add-ons, client name, duration, total,
  `BookingStatusBadge` (here "rescheduled" DOES matter — studio-side info),
  client note prominently (allergies etc.).
- **Collapsible weeks for planning ahead.** The **current week is expanded by
  default** (day groups labelled Today / Tomorrow / weekday); **future weeks
  collapse by default** to a header row (week range + appointment count, or
  "· open" when empty) that expands on tap. Render weeks through the furthest
  upcoming booking so calendar gaps are visible; **past bookings aren't in
  this view** (history is separate, below). Collapse state is client-side UI
  state, default-derived (current week open, rest closed) — persistence
  (URL/localStorage) is an optional later refinement, not v1. Group in the
  studio timezone via `src/lib/studio-time.ts`; derive week buckets there so
  the boundary math lives with the other TZ logic.
- **View toggle: Agenda ↔ Calendar.** A header control switches between the
  **Agenda** (default; the week→day list above) and a **condensed month
  Calendar** grid. View mode is client UI state (default agenda; remember the
  last choice per session — URL `?view=` / localStorage persistence optional).
- **Condensed Calendar (month grid).** Mobile-first 7-col grid (weeks start
  Monday), each day cell a quiet booking marker (dot, or count when >1; empty
  days blank), with today + selected-day states and prev/next-month nav.
  Tapping a day jumps into the Agenda at that day. **No separate data path** —
  both views render the same fetched bookings and reuse the studio-TZ week/day
  bucketing. Build order within the task: **Agenda first** (the working view),
  then the Calendar toggle; the Calendar can split into its own follow-up PR
  if this task grows too large.
- **Client contact per booking**: resolve `clerk_user_id` → name/email/phone
  via the Clerk Backend API (batched `getUserList`), rendered with `tel:` /
  `mailto:` links. Never persisted to our DB (no-PII rule).
- **Realtime** (the Phase 5 wiring, admin half): `postgres_changes`
  subscription on `bookings` through the browser client (owner RLS applies)
  → `invalidateQueries`/refresh so a new booking appears without reload.
  This is TanStack's second real consumer — `useQuery` for the list is
  appropriate here (unlike the client's server-rendered /bookings). A booking
  arriving in the **current week** slides its card in (brief sage highlight);
  one landing in a **collapsed future week** bumps that week's count without
  force-expanding it (don't yank the artist's scroll position).
- **Owner cancel**: reuse the cancel machinery with an owner-side server
  action (role re-checked; no 24 h policy for the owner) + confirm dialog.
  Reschedule-on-behalf links out to Cal's dashboard for now (owner is
  logged into Cal anyway) — in-app owner reschedule can come later.
- History view (past bookings, simple list, search by client name later).
- **Leave room for Task 06**: the card layout should accommodate an
  "awaiting reply" marker + acceptance toggle for studio-created bookings
  (origin/acceptance columns land with 06 — don't build them here, just
  don't design them out).
- **Leave room for Task 07**: the client name on a card becomes a link to
  `/admin/clients/[clerkUserId]` once the directory exists — render it as
  a distinct tappable element from day one.

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
