# Bella Nails — Developer Setup (from zero)

Everything needed to stand up this project on a new machine or a fresh set of
vendor accounts — **no prior context required.** Follow it top to bottom.

Bella Nails is a Next.js nail-studio site: public booking (via Cal.com), an
owner-only `/admin` CRM, and GDPR-compliant client media. Stack: **Next.js
(App Router) · Clerk (auth) · Supabase (Postgres/RLS/Realtime) · Cal.com EU
(scheduling) · Stripe via Cal.com (no-show holds) · Scaleway (media) · Zoho
(email) · Vercel (hosting)**.

> Deeper reference for any piece: [INFRASTRUCTURE.md](./INFRASTRUCTURE.md).
> This doc is the linear "do these steps"; that one is the "why / details".

---

## 0. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 20 LTS or newer | |
| **pnpm** | 11.x | The repo pins it via `packageManager`. Easiest: `corepack enable` (ships with Node) — it auto-uses the pinned pnpm. |
| **git** | any | |
| A password manager | — | You'll collect ~15 secrets. Never commit them. |

Accounts you'll create in **step 3** (all have a free tier): Supabase, Clerk,
Cal.com, Stripe, Scaleway, Zoho Mail, Vercel.

---

## 1. Get the code & install

```sh
git clone <repo-url> bellaNails
cd bellaNails
corepack enable          # makes `pnpm` resolve to the pinned version
pnpm install
```

---

## 2. Create the env file

```sh
cp .env.example .env.local     # .env.local is git-ignored — secrets live only here
```

You'll fill each value while creating the accounts in step 3. Full list, grouped
by vendor, with where each comes from:

| Variable | Public? | Where to get it (step 3) |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Your URL. `http://localhost:3000` locally; the real domain in prod. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Supabase → Project Settings → API (service_role) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | public | Clerk → API keys |
| `CLERK_SECRET_KEY` | **secret** | Clerk → API keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | public | Leave `/da/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | public | Leave `/da/sign-up` |
| `NEXT_PUBLIC_CALCOM_LINK` | public | Cal.com username (e.g. `bellanails`) |
| `CALCOM_WEBHOOK_SECRET` | **secret** | You invent it; set the same value on the Cal webhook |
| `CALCOM_API_KEY` | **secret** | Cal.com → Settings → Developer → API keys |
| `SCALEWAY_ACCESS_KEY` | **secret** | Scaleway → IAM → API keys |
| `SCALEWAY_SECRET_KEY` | **secret** | Scaleway → IAM → API keys (shown once) |
| `SCALEWAY_REGION` | secret-ish | `fr-par` |
| `SCALEWAY_ENDPOINT` | secret-ish | `https://s3.fr-par.scw.cloud` |
| `SCALEWAY_BUCKET` | secret-ish | `bellanails-media` |
| `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` | public | `https://bellanails-media.s3.fr-par.scw.cloud` |

**Rule:** anything **not** prefixed `NEXT_PUBLIC_` is server-only and must never
reach the browser. Mirror the same keys into Vercel (step 7).

---

## 3. Create the vendor accounts

### 3a. Supabase (database)
1. Create a project at [supabase.com](https://supabase.com) (choose an **EU region** for GDPR).
2. **Project Settings → API** → copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
3. Apply the schema — see **step 4**.

### 3b. Clerk (authentication)
1. Create an application at [clerk.com](https://clerk.com).
2. **API keys** → copy:
   - Publishable key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Secret key → `CLERK_SECRET_KEY` (**secret**)
3. Connect Clerk to Supabase using Supabase's **native third-party auth
   integration** (Supabase Dashboard → Authentication → Third-party Auth → Clerk).
   ⚠️ **Do NOT** use the old Clerk JWT template (deprecated 2025-04-01).
4. Owner/admin setup is **step 5** (do it after the DB exists).

### 3c. Cal.com (scheduling — EU instance)
> Use the **EU** instance: `cal.eu` / `app.cal.eu` / `api.cal.eu`.
1. Create an account; note your **username** → `NEXT_PUBLIC_CALCOM_LINK` (e.g. `bellanails`).
2. Create an **event type per service**; each maps to a `services.cal_event_id`/slug in the DB.
3. **Settings → Developer → API keys** → create one → `CALCOM_API_KEY` (**secret**;
   required for in-app cancel + post-booking sync + event-type sync).
4. **Webhook:** point a webhook at `https://<your-domain>/api/webhooks/cal`, event
   `BOOKING_CREATED`. Invent a signing secret and set it **both** on the webhook
   **and** as `CALCOM_WEBHOOK_SECRET` (**secret**).

### 3d. Stripe (no-show card holds)
- Configured **inside Cal.com**, not the app: Cal.com → connect Stripe → enable
  the card hold / SetupIntent on the event type. **No Stripe keys go in `.env`** —
  the app stores no card data.

### 3e. Scaleway (media storage)
Follow the dedicated runbook: [../infra/scaleway/README.md](../infra/scaleway/README.md).
Summary: create a **Private** bucket `bellanails-media` in **fr-par**, generate an
Object-Storage API key, **enable bucket encryption (SSE)**, set **CORS** (via the
`aws` CLI — no console UI), and rely on **per-object `public-read` ACL** for public
delivery. ⚠️ **Never set a bucket policy** — on Scaleway it locks your own key out.
Fill the six `SCALEWAY_*` vars.

### 3f. Zoho Mail (domain email — operational, no env vars)
- Domain email for `bellanails.dk` runs on **Zoho Mail, EU DC** — admin at
  **https://mailadmin.zoho.eu** (`.eu`, not `.com`). One mailbox
  (`home@bellanails.dk`) with aliases (`hello@`, `bookings@`, etc.). No app env.

### 3g. Vercel (hosting) — step 7.

---

## 4. Bootstrap the database

⚠️ **There is no single `schema.sql` yet** (a consolidation task is tracked in
[PLAN.md](./PLAN.md) Phase 9). For a fresh database, apply in this order via the
**Supabase Dashboard → SQL Editor**:

1. **Base schema** — the full SQL block under **“Schema”** in
   [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) (creates `services`, `categories`,
   `bookings`, `assets`, `gallery_items`, `addons`, …).
2. **Incremental patches** — the files in [`supabase/`](../supabase/). Most are
   idempotent (`create … if not exists`, `add column if not exists`) and
   order-independent, with two rules:
   - apply `media-and-consent.sql` **before** `storage-provider.sql`;
   - apply the policy/publication files **last**: `rls.sql`,
     `admin-owner-reads.sql`, `realtime.sql`.
   The rest (`booking-requests`, `service-addons`, `cal-event-ids`,
   `cal-event-slugs`, `categories-menu`, `booking-no-show`,
   `booking-client-notes`, `booking-reschedule-tracking`, `appointment-income`,
   `gallery-ordering`, `storage-provider`) alter the base tables.
3. **Seed data (dev only)** — `seed.sql` + `addons-seed.sql`. Skip on a database
   that already has real rows (they guard against double-seeding).

After changing the schema, keep the hand-maintained types in sync:
[`src/lib/supabase/types.ts`](../src/lib/supabase/types.ts) (edit by hand to match,
or regenerate with the Supabase CLI).

---

## 5. Make yourself the studio owner

`/admin` is gated to users with the `owner` role. **All four** must be true
(repeat per Clerk instance — dev *and* prod):

1. **Create the owner account** — sign up in the running app (step 6) with the
   owner's email. Put a passkey/2FA on it (it can read every client's PII).
2. **Set the role** — `publicMetadata.role = "owner"`. Clerk Dashboard → Users →
   the user → Metadata → Public: `{ "role": "owner" }`. (Or Backend API
   `PATCH /v1/users/<id>/metadata` with `{"public_metadata":{"role":"owner"}}`.)
3. **Expose the role in the session token** (the step everyone forgets — dashboard
   only). Clerk → **Configure → Sessions → Customize session token → Edit**:
   ```json
   { "metadata": { "role": "{{user.public_metadata.role}}" } }
   ```
   New sessions pick it up in ~60s (or sign out/in).
4. **Owner-reads-all RLS** — ensure `supabase/admin-owner-reads.sql` is applied
   (from step 4) so the owner reads the whole studio, not just their own rows.

**Verify:** sign in at `/admin` with the owner account → dashboard renders. A
signed-in non-owner → redirected to `/`.

---

## 6. Run locally

```sh
pnpm dev            # http://localhost:3000
```

Other scripts: `pnpm build` (production build), `pnpm start` (serve the build),
`pnpm lint`, `pnpm format`.

**Graceful degradation:** the app boots even with missing keys. Absent Scaleway
→ media features report “not configured”; absent `CALCOM_API_KEY` → in-app
cancel/sync is disabled. So you can bring vendors online one at a time.

---

## 7. Deploy (Vercel)

1. Import the GitHub repo into Vercel.
2. **Set every env var** from `.env.local` in Vercel → Project → Settings →
   Environment Variables, for **Preview** and **Production**. (Env vars are read
   at runtime, server-side — they are **not** baked into the build, so each
   environment needs its own copy.)
3. Point production URLs at the deploy: Cal.com webhook → `https://<domain>/api/webhooks/cal`;
   `NEXT_PUBLIC_SITE_URL` → the real domain; add the domain to Scaleway **CORS**
   (`infra/scaleway/cors.json` → re-run `put-bucket-cors`).
4. Redo the **owner setup (step 5)** on the **production** Clerk instance (`pk_live`).
5. Production deploys run from the **`deploy`** branch only, via:
   ```sh
   pnpm run deploy:prod        # scripts/deploy.sh — refuses unless on clean `deploy`
   ```

---

## 8. Launch checklist

- [ ] Supabase project (EU), schema + patches + policies applied, Realtime publication on.
- [ ] Clerk app + native Supabase integration + owner setup (all 4 steps) on **both** instances.
- [ ] Cal.com event types, webhook → prod URL + secret, API key, Stripe connected.
- [ ] Scaleway bucket + key + CORS + encryption, **no bucket policy**; live round-trip (private→403, public→200).
- [ ] Zoho mail delivering.
- [ ] Vercel: all env vars on Preview + Production; domain wired.
- [ ] Smoke test: booking → webhook → DB → `/admin` live update; upload a photo on `/bookings`.
