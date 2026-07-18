# Task 06 — Studio-created bookings (proposal → client approval)

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01 (shell)
> and Task 02 (queue, where these bookings surface).

## Goal

The artist books on a client's behalf — the client who emailed, DM'd on
social, or is sitting in the chair booking her next session as the current
one finishes. The slot is **hard-blocked in Cal immediately**; whether the
client has **accepted the proposed time** is tracked separately so the
artist knows what needs a follow-up.

## The key design fact

Cal has no "awaiting client approval" state (its `requiresConfirmation` is
the inverted direction — host approves client). So: **Cal owns the slot,
we own the acceptance.** Two new columns on `bookings`:

- `origin text not null default 'client'` — `'client' | 'studio'`
- `client_accepted_at timestamptz null` — the "accepted by client" toggle;
  client-origin bookings are implicitly accepted (they booked it).

New SQL file (`supabase/booking-origin.sql`), migration BEFORE code deploys
(same rule as always). Regenerate types.

## In scope

- **New-booking form** (mobile-first, from the queue): client email
  (required) + name (optional — improves the Clerk profile), service +
  add-ons picker (reuse the catalog read + `computeBookingTotals` for the
  slot length), date/time from **`GET /v2/slots`** for that event type and
  computed duration, optional note.
- **Create via `POST /v2/bookings`** (server action, owner-verified):
  attendee email/name/timeZone, eventTypeId, start, the computed
  `lengthInMinutes`, and the SAME metadata shape the embed sends
  (serviceId, addonIds, totals, locale, clientNotes) so the persist
  pipeline needs zero special-casing. ⚠️ Verify early that v2 create
  honors `lengthInMinutes` from the options list — this is the brief's
  main API risk.
- After Cal confirms: `syncBookingFromCal(uid)` persists the row, then the
  action stamps `origin = 'studio'` (acceptance stays null). Cal sends its
  standard confirmation email to the client automatically — which already
  carries our "manage your booking" line, so the client can see it on
  /bookings immediately. Identity: `ensureClerkUser` create-or-finds by
  email exactly as the webhook does — new clients get an account seed.
- **Acceptance tracking**:
  - Admin queue (Task 02): studio-origin, unaccepted bookings show an
    "awaiting reply" marker + proposal age; a one-tap toggle stamps/clears
    `client_accepted_at` (for "she said yes by email/DM"). A follow-up
    filter/group surfaces stale proposals (> 48 h).
  - Client side (`/bookings`): a studio-proposed, unaccepted upcoming card
    shows a gentle "Does this time work? **Confirm**" action → server
    action (RLS-verified own row) stamps acceptance. Declining = the
    existing cancel/reschedule actions — no new vocabulary.
- If the client never responds: the artist cancels via the existing owner
  cancel. No auto-expiry in v1 (the follow-up view makes it a human call).

## Out of scope

- Out-of-hours proposals — same "proposal awaiting response" pattern but
  needs slots Cal won't offer; stays with the deferred `booking_requests`
  flow (see PLAN Phase 8 B). Design this task so B can reuse the
  acceptance columns and queue affordances.
- SMS/DM sending. Cal's email + the in-app confirm are the channels.

## Acceptance criteria

- Artist books for a brand-new email → Cal blocks the slot; client receives
  Cal's email; a Clerk user exists; the row lands with `origin='studio'`,
  unaccepted; the queue shows "awaiting reply".
- Client signs in (email code) → sees the proposed booking → taps Confirm →
  `client_accepted_at` set → the queue marker clears in the artist's PWA
  (realtime).
- Manual toggle path works without the client ever signing in.
- `status` semantics untouched: the row is `confirmed` Cal-wise throughout;
  cancelling an unaccepted proposal behaves exactly like any cancel.
