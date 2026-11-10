# Task 10 — Insights: financial & occupancy overview

> Read [`00-context.md`](./00-context.md) first. Owner-only, `noindex`.
> Depends on Task 01 (shell) and the owner-reads-all RLS.

## Goal

An at-a-glance overview so the artist can sense how the studio is doing:
**monthly revenue from completed appointments** and **schedule occupancy** (how
well the time slots are used). Explicitly **indicative, not accounting**.

## Big disclaimer (non-negotiable, prominent)

A persistent, prominent notice at the top of the screen — not a footnote:

> **For information only — not an accounting or tax record.**

Rationale: figures are derived from stored booking totals and do **not** reflect
no-shows actually charged, tips, refunds, off-system discounts, Stripe fees, or
VAT. Never present as official financials. (It's the studio's own aggregate of
amounts + times — no client PII.)

## Financial overview

- **Monthly revenue** = Σ `total_price_cents` of **completed** appointments in
  each studio-timezone month. "Completed" = **ended** (`end_time < now`) **and
  active** (not cancelled, not future — future revenue isn't earned yet). Reuse
  the existing completed/active derivation.
- Per-month rows: month · # completed · total (render amounts via `PriceTag`,
  DKK). Current month plus recent months (reuse `groupBookingsByMonth` /
  `studioMonthKey` for the studio-TZ month buckets).

### Per-appointment income override

Because this is info-only (not a payment system), let the artist **correct the
income recorded per appointment** — to balance refunds, partial no-show
charges, tips, or off-system discounts.

- New **nullable** column `income_override_cents` on `bookings` (SQL:
  `supabase/appointment-income.sql`; migration before deploy; regenerate types).
  It **never overwrites** the booked `total_price_cents` — the Cal-quoted price
  stays the source of truth; the override is a separate manual figure.
- **Effective income = `income_override_cents ?? total_price_cents`** (use `??`,
  not `||`: a `0` override is a real value — full refund / not charged — and
  must not fall back to the booked price; `null` = no override).
- Owner edits it inline — a kr. number input on the appointment's **expanded
  card** — via an owner-verified server action (role re-checked; service-role
  write, same pattern as owner cancel). Owner-only write.
- **Which appointments count toward revenue:** completed (ended + active) using
  effective income, **plus** any appointment with an explicit override set (so a
  no-show fee on a cancelled slot is captured, and a refunded one can be zeroed).
- Show a subtle **"adjusted"** marker on overridden appointments so the figure
  stays transparent. The info-only disclaimer still applies — this is the
  artist's own bookkeeping-lite, not payment processing.

## Occupancy

- **Footprint per appointment** = duration (`end_time − start_time`) **+ the
  30-min buffer** (`afterEventBuffer` — the artist's real turnaround; the
  calendar blocks it, so it's part of utilisation).
- **Occupancy %** (period) = Σ footprint ÷ **available working minutes** in the
  period. Purpose: see whether slots are used optimally — spare capacity vs a
  packed schedule (informs pricing / opening more hours).
- Realized occupancy uses **completed** (past) appointments; optionally show a
  separate **projected** occupancy from upcoming ones.
- ⚠️ **Prerequisite / decision — define the studio's working hours.** Available
  capacity needs the studio's open schedule, which today lives in Cal.com's
  availability schedule, not our DB. Options: **(a)** mirror studio hours into
  `config/studio.ts` (open days + hours), or **(b)** read Cal.com's availability
  via API. Start with (a) (simple, no API); revisit (b) if hours change often.
- The 30-min buffer is a Cal per-event-type value (currently 30 for every
  service). Use a constant now; derive per-service if buffers ever diverge.

## Placement / IA

- A new owner-only screen (e.g. `/admin/overview`), linked from **More**.
  Optionally a compact revenue + occupancy band on the Queue. `noindex`.

## Data / reuse

- `bookings`: `total_price_cents`, `start_time`, `end_time`, `status`,
  `selected_addons` (→ `durationMins`). **Owner-reads-all RLS** (studio-wide).
- `studio-time` (studio-TZ month grouping), `ADMIN_LOCALE`, `PriceTag` (DKK),
  the shared "completed"/active derivation. **No client PII** — amounts + times
  only.

## Out of scope

- Real accounting, exports, tax, Stripe fee reconciliation, per-service P&L,
  charts/graphs beyond the two headline numbers. It's an indicator, not a books.

## Acceptance criteria

- Monthly revenue total matches a hand sum of each appointment's **effective
  income** (`income_override_cents ?? total_price_cents`) for that month, in DKK.
- Setting an income override updates the monthly total; a `0` override counts as
  zero (not the booked price); non-owners can't write it (RLS/action verified).
- Occupancy % reflects footprint (duration + 30-min buffer) over the defined
  working hours; verify a hand-computed month.
- The "information only" disclaimer is always visible on the screen.
- Non-owner cannot reach it (RLS + proxy gate verified).
