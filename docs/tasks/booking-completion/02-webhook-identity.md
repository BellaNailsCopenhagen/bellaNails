# Task 02 — Cal webhook + Clerk identity sync

> **File paths below predate the Aug 2026 restructure.** `src/lib/**` and
> `src/components/sections/` no longer exist; the layers are now `app/`, `modules/`,
> `db/`, `platform/`, `shared/`. This document is kept as a record of the work as it
> was done — for current locations see [architecture.md](../../architecture.md).

> Read [`00-context.md`](./00-context.md) first. Backend only — no UI.

## Goal

Persist bookings and own the client identity. Two pieces:
1. `/api/webhooks/cal` — validate the signature, and on `BOOKING_CREATED`
   upsert into `bookings`.
2. A **Clerk profile server action** — create-or-find the client's Clerk user
   by email and complete their profile from data we captured, so PII lives in
   Clerk and our DB only stores `clerk_user_id`.

## Depends on

Env/secrets present (`CALCOM_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`). Task 01 not
strictly required to build, but a real booking from Task 01 is the easiest way
to exercise it end-to-end.

## In scope

### Webhook — `src/app/api/webhooks/cal/route.ts`

- Route handler (Node runtime). **Verify the Cal signature** against `CALCOM_WEBHOOK_SECRET` before trusting the body; reject invalid → 401.
- Handle `BOOKING_CREATED` (design `BOOKING_RESCHEDULED` / `BOOKING_CANCELLED` handling too — update `status`, times, and cancel/reschedule URLs on the existing row by `cal_booking_id`).
- Upsert into `bookings` (service-role client) keyed on `cal_booking_id` (unique): map `status`, `start_time`, `end_time`, `reschedule_url`, `cancel_url`.
- Read the **machine metadata** (IDs only — never parse the human notes string): `{ serviceId, addonIds[], totalPriceCents, totalDurationMins, locale }` → persist `total_price_cents` and `selected_addons` (jsonb).
- Resolve `clerk_user_id` by calling the identity server action (below) with the attendee email; store the returned id. `bookings` needs **no schema change**.
- Idempotent: a duplicate delivery for the same `cal_booking_id` must not create a second row or corrupt data.
- The endpoint must exist and be deployed **before** the webhook is registered in Cal (Settings → Developer → Webhooks; secret → `CALCOM_WEBHOOK_SECRET`).

### Identity — `src/lib/clerk/ensure-user.ts` (server-only)

- `ensureClerkUser({ email, name?, phone? })`:
  - **Create-or-find** a Clerk user by email (Clerk Backend API, passwordless — no password set).
  - **Fill-if-empty**: set `firstName`/`lastName`/`phoneNumber` only where the Clerk profile doesn't already have them. **Never clobber** client-set values.
  - Return the `clerk_user_id`.
- Reused by the webhook and later by the account opt-in from Task 01 / Task 03.

## Out of scope

- Any UI (Tasks 01, 03, 04 own it).
- Storing client PII in Supabase — email/name/phone stay in Clerk.
- Out-of-hours `booking_requests` flow (Phase 8).
- Stripe.

## Acceptance criteria

- A real test booking (from Task 01 or the Cal dashboard) produces exactly one `bookings` row with correct `cal_booking_id`, `total_price_cents`, `selected_addons` (from metadata), and a resolved `clerk_user_id`.
- Invalid/absent signature → rejected, no DB write.
- Reschedule then cancel via the emailed links updates the same row's `status` on each event.
- Booking with a brand-new email creates a Clerk user (passwordless); booking with an existing user's email reuses it and fills only empty profile fields.
- Duplicate webhook delivery is a no-op.

## Verification

- Replay a captured Cal `BOOKING_CREATED` payload against the endpoint (valid + tampered signature).
- Check the Supabase row via MCP; confirm no PII columns were added.
- Confirm the created Clerk user appears in the dashboard with the expected (non-clobbering) profile.
- `pnpm lint` + `pnpm build` green.

## Relevant skills

`clerk-backend-api` (create-or-find + update user), `clerk-nextjs-patterns/references/api-routes.md` + `references/server-actions.md`. Read the Cal webhook signature docs (EU) before implementing verification.
