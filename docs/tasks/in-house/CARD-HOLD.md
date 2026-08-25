# Guest card-hold — Stripe authorization hold (spam + no-show defense)

Status: **plan / awaiting business decisions.** Supersedes the per-email cap idea
(email is fakeable → useless as a key and weaponizable against real clients). The
per-IP rate-limit + honeypot (`feat/booking-abuse-guard`) stays as the cheap floor.

## Locked decisions
- **Authorization hold**, not a charge — manual-capture `PaymentIntent`. Good
  clients are never actually charged.
- **Guests / first-timers only** — activated clients with a clean record book as
  they do today. (All spam is "new", so it's fully covered.)
- **No phone/SMS OTP** — avoids a second vendor; the existing **email-OTP** is the
  validation path instead (see "Spam gate").
- **Guest spam gate = validated sign-in OR card** — email-OTP (free, ships before
  Stripe) is the spam layer; the card adds the no-show cover on top.

## Why this shape
- Attacks spam **economically** (no real card → no booking) instead of guessing at
  bots, and simultaneously **deters/monetises no-shows**.
- Plugs into the existing no-show flow: `no_show_at`, `canMarkNoShow`,
  `setBookingNoShow` → **capture** the hold as the fee when a no-show is marked.

## The hard wrinkle — auth holds expire (~7 days)
A card authorization expires after ~7 days, so a booking placed further out can't
hold at book-time. Options:
- **A (recommended):** hold immediately when the appointment is ≤7 days out; for
  further-out guest bookings, `SetupIntent` (save the card) at booking and place
  the hold via a scheduled job ~2 days before. Needs a scheduler (Vercel Cron or
  Supabase `pg_cron`) — the one piece of new infra.
- **B:** always save the card (`SetupIntent`), charge a no-show fee after the fact.
  Simplest holds-wise, but charging after the fact invites disputes.
- **C:** guests may only book within the 7-day window (hold immediately); further
  out requires an account. Simplest, most limiting.

→ **Chosen: A.** Vercel Cron is needed anyway (appointment reminders to client +
artist, automated review requests), so the scheduler is shared infra — which
removes A's only real downside.

## Architecture (app → modules → db → platform)
- `platform/stripe/` — the ONLY files that name Stripe. Server client +
  `createHold / captureHold / releaseHold` (and `saveCard` for path A/B).
  Env-guarded: no keys → the whole guard no-ops (dev/degrade).
- `modules/booking/` — decides gating, creates the hold, ties it to the booking
  lifecycle. Booking is created **only after** the hold succeeds.
- `db/bookings` — new payment columns (migration below).
- `app/api/stripe/webhook/route.ts` — verify the signature; sync PaymentIntent
  status; handle async auth failures.
- Client — a card step (Stripe `PaymentElement`) in `/book`, rendered **only when
  gated**.

## Gating — who needs a card (or a validated sign-in)
A guard applies if **any**: not signed in (guest email) · signed-in but not
`activated` / first booking · prior no-show(s) (`NO_SHOW_ALERT_THRESHOLD`). For
those, the booker must clear the **spam gate** below — a card, *or* a validated
email sign-in. Skip entirely for an activated client with a clean record.

## Spam gate: validated identity OR card
A guest doesn't have to hand over a card to prove they're real — validating an
email is a cheaper alternative, and we already have it (Supabase email-OTP is the
whole login). So the guest gate is a **choice**:

> returning signed-in client (clean record) → book free ·
> guest → **sign in (validate email)** OR **add a card**.

- **Email validation = the SPAM layer.** It forces the booker to control an inbox
  and read a code, which kills casual/fake-email spam. Nearly free (reuses the
  existing OTP) and **can ship before the Stripe work** as an interim defense.
- **The card = the NO-SHOW layer.** A validated-email account holder can still
  no-show for free; only the hold deters that. The two are complementary —
  email-validation covers spam, the card covers no-shows.
- **Honest limit:** disposable/temp-email services let a determined bot validate
  throwaway inboxes at scale, so email-OTP stops casual spam, not a serious
  attacker. Optional hardening: a disposable-email domain blocklist (an arms
  race; skip unless abused).

Sequencing: land the **sign-in half now** (no Stripe) as the interim spam gate,
then add the **card option** with the hold work (which also brings no-show cover).

## Lifecycle
```
book (gated)      → manual-capture PaymentIntent (hold) → success → create booking
show / in-policy cancel → cancel PI  (release hold, no charge)
no-show (owner marks)   → capture PI (charge the fee)     ← into setBookingNoShow
reschedule        → release old hold, place new (or carry if same window)
```

## DB — `supabase/booking-card-hold.sql`
`bookings` add: `stripe_payment_intent_id text`, `hold_status text default 'none'
check (none|authorized|released|captured|saved)`, `hold_amount_cents int`, and
(for path A/B) `stripe_customer_id` / `stripe_payment_method_id`.

## Business decisions to confirm
1. **Hold amount** — flat (e.g. 200 DKK) or % of the service price?
2. **No-show fee** — the full hold, or partial?
3. **Cancellation window** — tie to the existing **24 h policy**: cancel ≥24 h →
   release; cancel <24 h or no-show → capture? (A late cancel is a no-show
   economically.)
4. **Reschedule** — release + re-hold, or carry the hold?
5. **Terms** — the hold + no-show-fee policy **must be disclosed and accepted**.
   You already have a terms system → add a card-policy term and gate booking on it.

## Related: active-booking cap + overflow request (separate feature)
A real client needs at most **2 active bookings** (hands + feet), so cap active
(upcoming, non-cancelled) bookings per client at **2**. A 3rd is blocked with a
clear "you already have 2 active bookings (max 2)" message, and offered an
**overflow request**: a short *mandatory* note + the chosen service/time goes to
the artist as a notification stating the **time can't be guaranteed**; the artist
accepts it into a real booking, or the client just contacts them by email/phone.

This is a "booking request → artist approval" pattern that should **share one
`booking_requests` mechanism with the (not-yet-built) outside-normal-hours request
flow**. Neither exists today.

The cap keys on client_id (email), so it's a **usage rule for real clients, not an
anti-bot measure** — email-rotation bypasses it; that's the card-hold's job. Count
via `listUpcomingBookingsForClient` (already in `db/bookings.ts`).

## Build phases
1. `platform/stripe` adapter + env + webhook skeleton (signature verify).
2. DB migration + `db/` helpers.
3. Gating + create-hold wired into `createBooking` (booking only after hold OK).
4. Client card step (`PaymentElement`), gated render.
5. Lifecycle: release on show/cancel; **capture on no-show** (into `setBookingNoShow`).
6. Far-future path (SetupIntent + scheduled hold) — or defer with the 7-day limit (option C).
7. Terms: card-policy term + acceptance gate.

## Out of scope / later
Saved cards for faster returning-client rebooking; partial-refund / dispute UI.
