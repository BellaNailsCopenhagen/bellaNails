# Phase 11 — retire Clerk + Cal.com: decision & plan

## Decision (2026-08-19)
**Retire both Clerk and Cal.com.** Rationale is recorded in `docs/PLAN.md` Phase 11 (email ownership, EU-sovereign PII, Cal is now a thin slice of a thick flow). Doing it now — before more of the schema/code grows around `clerk_user_id` and Cal ids — is the right call.

Keep unchanged: **Scaleway** (media) and **Supabase** (data). Login stays **Google, Apple, email one-time-code (passwordless)** — moved from Clerk to **Supabase Auth**. Scheduling comes **in-house** (multiple services + add-ons, the Phase 6 domain rules carry over verbatim).

## Why this was NOT executed overnight (and shouldn't be)
A partial rip-out breaks the live app, and the swap needs things only the owner/an awake session can do safely: apply Supabase migrations (connector is down here), configure OAuth apps (Google/Apple) + Supabase Auth, and **test auth + booking end-to-end** (untestable headless). So this doc delivers the **decoupling design + sequenced plan**; the actual swap runs with the owner present.

## The key move you asked for: a provider-agnostic function layer
Every component calls these functions — never Clerk or Cal directly. Swapping a provider then means re-implementing one facade, with zero component changes. Build these as facades over the CURRENT providers first (non-breaking), migrate components onto them, then swap the innards.

### `src/lib/booking/` — booking service
```
getAvailableSlots(serviceId, addonIds, range): Slot[]
createBooking(input): BookingResult          // input: service, addons, start, contact
rescheduleBooking(bookingId, newStart): BookingResult
cancelBooking(bookingId): BookingResult
getBooking(id) / listBookings(userId, filter)
```
Today these map onto `booking-sync.ts` / `booking-cancel.ts` / the Cal embed + webhook. The **in-house** implementation adds `availability_windows` + `availability_overrides` tables, slot generation (**generate in Europe/Copenhagen, store UTC**), and the double-booking guarantee as a Postgres exclusion constraint (`btree_gist`, `tstzrange`, predicate mirroring `isActiveBookingStatus`). Services already support multiple + add-ons; couple each service to its bookable options here.

### `src/lib/identity/` — identity service
```
getCurrentUser(): User | null
signIn(provider) / signOut()                 // google | apple | email-otp
ensureUser(email, name?, phone?): userId      // create-or-find (today ensure-user.ts)
getUserContact(userId): { name, email, phone }
```
Today these wrap Clerk. The **Supabase Auth** implementation adds a `clients` table (id, email, name, phone) and rewrites the six `clerk_user_id`-keyed RLS policies to the new id. `getUserContact` reads the `clients` table instead of the Clerk Backend API.

## Sequenced execution (each step reviewed, deployable)
1. **Facades over current providers** — build `booking/` + `identity/`, migrate components to call them. Non-breaking; behaviour identical. *(Safe to do next; the seam that de-risks everything after.)*
2. **Supabase Auth setup (owner)** — enable Google + Apple + email-OTP; register the OAuth apps; wire Supabase third-party/native auth.
3. **`clients` table + PII migration** — new table; backfill from Clerk; rewrite RLS on `bookings`, `booking_requests`, `client_media`, `media_consents`, `client_consents`, `owner_notifications`, `terms_acceptances` from `clerk_user_id` → `client_id`. Big migration; apply with the app in a maintenance window.
4. **Swap identity facade → Supabase Auth**, remove Clerk. Test all auth + admin gate.
5. **In-house scheduler** — availability tables, slot gen, exclusion constraint, booking CRUD, branded emails (ZeptoMail + `scheduled_emails` + cron). Swap booking facade → in-house, remove Cal. Test booking → row → admin.
6. **Cleanup** — drop Cal/Clerk deps, env, and the third-party-auth wiring.

Prereqs to gather before step 2: Google OAuth client, Apple Sign-In service id + key, and confirmation of the studio's real working hours (the availability denominator — also unblocks Insights).
