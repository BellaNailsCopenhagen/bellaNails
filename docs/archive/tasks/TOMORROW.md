# Morning — action list

## What happened overnight
You ran **`auth-cutover.sql`** (+ `studio-hours.sql`). That migrated the DB off
Clerk: `clerk_user_id` → `client_id` (new `clients` table), RLS moved to Supabase
Auth, and all client-identity data + published media were **wiped** (your call).

So I completed the **code cutover** to match: Clerk is fully removed, the app now
runs on **Supabase Auth** (Google + email OTP). It **builds, tsc + eslint are
clean**. But auth **won't function until you finish the Supabase setup below** —
until then no one can log in and `/admin` is unreachable. Public pages (home,
services, gallery) still render (gallery is empty after the wipe).

## 1. Make Supabase Auth work (owner — Supabase dashboard)
- [ ] **Google**: Authentication → Providers → enable Google, paste the OAuth
      client id/secret (the code you were waiting for). In Google Cloud, set the
      authorized redirect URI to `https://<project>.supabase.co/auth/v1/callback`.
- [ ] **Email OTP**: enable the Email provider. Under Email Templates → “Magic
      Link”, make it send the **code**: include `{{ .Token }}` (our /login expects
      a 6-digit code, not a magic link).
- [ ] **SMTP**: Authentication → SMTP settings → point at **ZeptoMail** (so OTP
      emails actually send).
- [ ] **URLs**: Authentication → URL Configuration → add your site URL and the
      redirect `https://<your-site>/api/auth/callback` to the allow-list.

## 2. Become the owner
`/admin` is gated on `app_metadata.role = 'owner'`. app_metadata is server-set,
so do this AFTER you’ve logged in once (which creates your `auth.users` row):
- [ ] Log in once at **`/da/login`** (Google or email code).
- [ ] In the SQL editor:
      `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}'::jsonb where email = '<your-email>';`
- [ ] Log out and back in (so the new claim is in your session), then open `/admin`.

## 3. Re-run these fixed SQL functions (I found bugs after you applied the files)
All are `create or replace` — safe to re-run, **no data impact**. Copy from the
files, or run as-is:
- [ ] From **`supabase/studio-hours.sql`**: `is_hour_ranges` + `is_weekly_hours`
      (now enforce *exactly two* elements, and add `set search_path`).
- [ ] From **`supabase/auth-cutover.sql`**: `link_client_on_auth_user`
      (guards a null email).

## 4. Test (after 1–2)
- [ ] `/da/login` → **Continue with Google** completes and lands you back signed in.
- [ ] `/da/login` → **email code** arrives and verifies.
- [ ] Header shows the account menu (initial + Sign out) when signed in; **Sign
      out** works.
- [ ] `/admin` reachable as owner; a non-owner (or signed-out) is redirected.
- [ ] `/da/appointments` shows *your* bookings only (make a test booking first —
      the Cal webhook still runs until we replace Cal; it now create-or-finds a
      `clients` row by email and writes `client_id`).
- [ ] Book a service end-to-end → confirmation → a `bookings` row appears in the
      admin queue (live-updates via Realtime).

## Verify these (I couldn't test them headless)
- **Proxy session + redirects**: the Supabase session cookie is refreshed in
  `src/proxy.ts` and merged onto redirect/i18n responses — watch for any redirect
  loop or dropped session on navigation.
- **Admin Realtime**: the live queue now relies on the browser client’s own
  session for socket auth (no more manual Clerk-token refresh) — confirm new
  bookings still appear without reload.

## Later (deferred, decided)
- **Cal.com replacement** — full plan is next after auth is confirmed working
  (booking CRUD + transactional email: reminders cron/queue, consent-by-email for
  account-less clients, automated create/edit/delete/consent/testimonial/video
  emails). Requirements captured; I’ll write the plan.
- **Content/config** still pending: real social links (`src/config/routes.ts`),
  final `/terms` + `/privacy` text, feature flags review.

## Notes
- **Vercel token** expired repeatedly — `pnpm dlx vercel whoami` refreshes it
  before `pnpm run deploy:prod` if a deploy 401s.
- `routes.signIn` now points at `/login`; the old Clerk `/sign-in`, `/sign-up`,
  `/account` pages were deleted. `@clerk/*` deps remain in package.json (unused) —
  removable in cleanup once you’ve confirmed everything works.
