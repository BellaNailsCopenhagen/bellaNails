# Bella Nails — Infrastructure & Base Setup

> The concrete wiring: every external service, the accounts/keys it needs, env vars, the
> proposed folder layout, the DB DDL, and per-service gotchas. Companion to
> [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) and [PLAN.md](./PLAN.md).
>
> **Cost target: ~0 DKK** — every service below is on a free tier.

---

## Service inventory

| Service | Plan | Role | Provides | App-side install |
|---|---|---|---|---|
| **Vercel** | Hobby (free) | Hosting / CI / preview deploys | Edge + serverless runtime, env mgmt | — |
| **Supabase** | Free | Postgres + Auth bridge + Realtime + Storage(unused, Scaleway instead) | DB, RLS, Realtime | `@supabase/supabase-js` |
| **Clerk** | Free | Authentication + user mgmt | Sign-in/up, `role` metadata, JWT for Supabase | `@clerk/nextjs` |
| **Cal.com** | Cloud Free | Scheduling | Availability, booking, reschedule/cancel URLs, webhooks | `@calcom/embed-react` |
| **Stripe** | Pay-as-you-go (no fixed fee) | No-show card holds | SetupIntents via Cal.com | (none in app — via Cal.com) |
| **Scaleway Object Storage** | Free tier (75 GB) | EU-sovereign media storage (fr-par) | S3-compatible image/video hosting; private-by-default, publish-on-consent | `@aws-sdk/client-s3` + presigners |
| **next-intl** | OSS | i18n | Routing + message loading | `next-intl` |

---

## Environment variables

Create `.env.local` (git-ignored) locally and mirror in Vercel. Commit a secret-free **`.env.example`**.

```bash
# ── Supabase ────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only; never expose to client

# ── Clerk ───────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# locale-aware auth routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/da/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/da/sign-up

# ── Cal.com ─────────────────────────────────────────────
NEXT_PUBLIC_CALCOM_LINK=bellanails/session
CALCOM_WEBHOOK_SECRET=              # validates /api/webhooks/cal signature

# ── Scaleway Object Storage (media) ─────────────────────
SCALEWAY_ACCESS_KEY=                    # server-only
SCALEWAY_SECRET_KEY=                    # server-only
SCALEWAY_REGION=fr-par
SCALEWAY_ENDPOINT=https://s3.fr-par.scw.cloud
SCALEWAY_BUCKET=bellanails-media
NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL=https://bellanails-media.s3.fr-par.scw.cloud

# ── App ─────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> Stripe keys generally live in the **Cal.com** dashboard (Cal owns the SetupIntent flow), not the app.
> Add `STRIPE_*` here only if the app ever talks to Stripe directly.

---

## Proposed folder layout

```
src/
├─ app/
│  ├─ [locale]/                 # all localized routes live here (Next 16: params is async)
│  │  ├─ layout.tsx             # ClerkProvider + NextIntlClientProvider + Query provider; <html lang>
│  │  ├─ page.tsx               # home
│  │  ├─ services/page.tsx
│  │  ├─ gallery/page.tsx
│  │  ├─ book/page.tsx          # Cal.com embed
│  │  ├─ confirmation/page.tsx
│  │  ├─ my-bookings/page.tsx   # authed
│  │  └─ admin/                 # owner-gated
│  ├─ api/
│  │  └─ webhooks/cal/route.ts  # signature-validated BOOKING_CREATED → upsert bookings
│  ├─ globals.css               # ✅ brand tokens (done)
│  └─ favicon.ico
├─ proxy.ts                     # ⚠️ Next 16 middleware replacement — locale routing
├─ i18n/
│  ├─ routing.ts                # locales ['da','en'], defaultLocale 'da'
│  └─ request.ts                # next-intl request config
├─ components/
│  ├─ ui/                       # shadcn primitives
│  └─ brand/                    # Eyebrow, SectionHeading, PriceTag, etc.
├─ lib/
│  ├─ utils.ts                  # ✅ cn()
│  └─ supabase/{client,server,types}.ts
├─ hooks/
│  └─ use-realtime-bookings.ts  # subscribe → invalidateQueries
messages/
├─ da.json
└─ en.json
.env.example
```

---

## Supabase

### Schema (apply with `_da` rename, prices in cents, soft-delete)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- A. SERVICE MENU
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  cal_event_id INT NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_da VARCHAR(255) NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_da TEXT NOT NULL DEFAULT '',
  base_price_cents INT NOT NULL,
  base_duration_mins INT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NULL
);

-- B. ADD-ONS
CREATE TABLE addons (
  id SERIAL PRIMARY KEY,
  service_id INT REFERENCES services(id) ON DELETE CASCADE,
  name_en VARCHAR(255) NOT NULL,
  name_da VARCHAR(255) NOT NULL,
  extra_price_cents INT NOT NULL,
  extra_duration_mins INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NULL
);

-- C. ADD-ON INCOMPATIBILITIES
CREATE TABLE addon_incompatibilities (
  addon_id_a INT REFERENCES addons(id) ON DELETE CASCADE,
  addon_id_b INT REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (addon_id_a, addon_id_b),
  CONSTRAINT check_addon_order CHECK (addon_id_a < addon_id_b)
);

-- D. GALLERY / PORTFOLIO MEDIA
CREATE TABLE gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type VARCHAR(10) NOT NULL,        -- 'image' | 'video'
  display_mode VARCHAR(20) NOT NULL,      -- 'portfolio_only' | 'before_after'
  primary_media_url TEXT NOT NULL,
  before_media_url TEXT DEFAULT NULL,
  title_en VARCHAR(255),
  title_da VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E. BOOKINGS ARCHIVE (synced from Cal.com webhook)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id INT UNIQUE NOT NULL,
  clerk_user_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,            -- 'confirmed' | 'rescheduled' | 'cancelled'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reschedule_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,
  total_price_cents INT NOT NULL,
  selected_addons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_services_lookup ON services(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_addons_lookup ON addons(service_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_bookings_user ON bookings(clerk_user_id);
CREATE INDEX idx_gallery_render ON gallery_items(sort_order, display_mode);
```

### Realtime
- Off by default — add live tables (e.g. `bookings`) to the `supabase_realtime` publication.
- Realtime respects RLS: the Realtime client must carry the **Clerk token**, and RLS must be written against Clerk claims, to receive events on private tables.
- Non-sensitive signals (e.g. "slot taken") can use a simpler public **broadcast** channel instead.

### RLS sketch
- `services`, `addons`, `gallery_items`: public `SELECT` where `archived_at IS NULL`; writes restricted to owner.
- `bookings`: a user reads only their own (`clerk_user_id = auth claim`); owner reads all; writes via service-role in the webhook.

---

## Clerk ↔ Supabase auth (the real gotcha)

- Use Supabase's **native third-party auth integration** for Clerk. **Do NOT** use the old Clerk JWT template — **deprecated 2025-04-01**.
- RLS policies + Realtime auth both key off Clerk claims, so the Realtime client must be initialized with the Clerk session token.
- **Known bug (Clerk custom domain):** Supabase Realtime fetches JWKS at `{issuer}/.well-known/jwks`, but Clerk custom domains serve `/.well-known/jwks.json` → JWT verification 404s. **Test authed Realtime early** if you use a custom Clerk domain.
- Admin gating: Clerk metadata `{"role":"owner"}` checked in `proxy.ts` for **`/admin`** (English-only, **not** locale-prefixed — see [tasks/admin/01-shell-auth-pwa.md](./tasks/admin/01-shell-auth-pwa.md)), **and** enforced again in RLS (defense in depth). Setting the role on the user is **not enough** — it must also be exposed in the session token (below).

### Admin owner setup (repeatable — do ALL of it per Clerk instance: dev AND prod)

`/admin` is gated to users with the `owner` role. Four things must all be true or the gate stays shut / the data stays scoped:

1. **Owner account exists.** A Clerk user for the owner's email. Preferred identity: a **named, non-public** address on the studio domain — `veronica.a@bellanails.dk` (a Zoho alias on Veronica's own mailbox is fine; **not** `hello@`, which is public). The developer's own account may also be an owner in **dev** for testing. Put a **passkey/2FA** on any owner account — it can read every client's PII.
2. **Role on the user** — `publicMetadata.role = "owner"`. Dashboard (Users → user → Metadata → Public) or Backend API (the `/metadata` endpoint **merges**, so it won't clobber other keys):
   ```bash
   # KEY = CLERK_SECRET_KEY for the TARGET instance; find <ID> via GET /v1/users?limit=100
   curl -s -X PATCH "https://api.clerk.com/v1/users/<ID>/metadata" \
     -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"public_metadata":{"role":"owner"}}'
   ```
3. **Role exposed in the session token** (the step everyone forgets — **dashboard only**, no Backend API). **Configure → Sessions → Customize session token → Edit**, add:
   ```json
   { "metadata": { "role": "{{user.public_metadata.role}}" } }
   ```
   New sessions pick it up within ~60s (or sign out/in). Without this, `sessionClaims.metadata.role` is empty and even a role-bearing user is bounced home. Same claim path backs the RLS below.
4. **Owner-reads-all RLS applied** so the owner reads the whole studio, not just their own rows: apply [../supabase/admin-owner-reads.sql](../supabase/admin-owner-reads.sql) via the Supabase MCP. The gate/dashboard render without it; the count is just scoped to the owner's own bookings until it's applied.

**Verify:** sign in at `/admin` with an owner account → dashboard renders (not redirected). A signed-in non-owner → redirected to `/`.

**Status — dev instance (July 2026):** ✅ `veronica.a@bellanails.dk` + `alburaul@gmail.com` set to `owner` (step 2). ⬜ session-token claim (step 3) · ⬜ owner-reads-all RLS (step 4) · ⬜ production instance (all four again on `pk_live`).

---

## Cal.com + Stripe

- Embed via `@calcom/embed-react`, `calLink` = `bellanails/session`. Theme it: `brandColor` Onyx `#121212`, `bodyBg` Alabaster `#FBFBFA`, matching fonts/radii. Pass the active language. Redirect to `/[locale]/confirmation` on success.
- Each `services.cal_event_id` maps to a Cal.com event type.
- **Webhook:** Cal.com → `POST /api/webhooks/cal`. Validate signature with `CALCOM_WEBHOOK_SECRET`. On `BOOKING_CREATED`, upsert into `bookings` (by `cal_booking_id`). Use the Supabase **service-role** client here (bypasses RLS).
- **Stripe no-show holds:** configured in Cal.com (connect Stripe, enable card hold / SetupIntent on the event type). The app stores no card data.

---

## Scaleway Object Storage (media)

EU-sovereign (France, fr-par), S3-compatible. Full design + runbook:
[docs/tasks/storage-scaleway-migration.md](tasks/storage-scaleway-migration.md) ·
[infra/scaleway/](../infra/scaleway/).

- **Private-by-default**: uploads land in `private/`; the bucket is Private and stays that way.
- **Browser upload** = server issues a short-lived **presigned POST** (role-scoped size/type limits); bytes go straight to the bucket, never through our function.
- **Publish-on-consent** = `CopyObject` `private/`→`public/` with **`ACL: public-read`** (⚠️ never a bucket policy — it locks the owner's key out). Withdraw/erase = `DeleteObject`.
- **Private reads** = short-lived **presigned GET** (rendered with plain `<img>`, not `next/image`). Consented `public/` objects use the stable public URL and are allowed in `next/image`.
- **No transforms** (unlike Cloudinary): clients strip EXIF + crop 4:5 + downscale in the browser before upload; owner uploads (incl. demo video) are stored as-is.
- All access is via `src/lib/storage/scaleway.ts`, env-guarded — absent keys → `not_configured`, app still boots.

---

## Email (Zoho Mail)

- Domain email for `bellanails.dk` runs on **Zoho Mail, EU data center** — admin console **https://mailadmin.zoho.eu** (**not** `.com`; Zoho hit us with EU-DC friction before on Zoho Calendar OAuth, so always use `.eu`).
- **One mailbox, many hats.** The primary mailbox is Veronica's (`home@bellanails.dk`); `hello@` (the public contact = `STUDIO_EMAIL`), `bookings@`, `infrastructure@`, and `veronica.a@` are **aliases** on it — all deliver to that one inbox.
- **Add an address** (mailadmin.zoho.eu):
  - **New mailbox** — separate login/inbox, **costs a seat**: **Users → Add → Add user**, set the local part + `@bellanails.dk`, set a password, Save.
  - **Alias** — free, delivers into an existing mailbox: open the user → **Mailbox Settings → Email Alias → + Add**. An alias is **not** a separate login; use it for role/extra addresses (or to give one person a tidy named address).
- MX/SPF/DKIM are already configured (existing addresses deliver), so a new address/alias works immediately — no DNS step.
- Transactional/alert mail (e.g. the interim "new booking" admin alert) sends via Zoho — stay within the adopted vendor stack, no separate ESP.

---

## next-intl (⚠️ Next 16)

- Locales `['da','en']`, **default `da`**, URL path-based (`/da`, `/en`).
- Next 16 renamed middleware → **`proxy.ts`** (`export function proxy()`). Wire next-intl's locale handling there; confirm the installed next-intl version supports the `proxy` convention (or call its handler from within `proxy`).
- Messages in `messages/da.json` + `messages/en.json`, short descriptive keys (`services.gel.title`). Server-rendered to avoid flicker.
- `params` is async in pages/layouts: `const { locale } = await params`.

---

## Pre-flight checklist (accounts to create / things to have ready)

- [ ] Supabase project (URL, anon key, service-role key) + schema applied + Realtime publication.
- [ ] Clerk app (publishable + secret keys) + native Supabase integration configured + owner set up per **Admin owner setup** above (role + session-token claim + RLS) — repeat on the prod instance.
- [ ] Cal.com account, event type(s) matching `cal_event_id`, webhook → prod URL, signing secret, Stripe connected.
- [ ] Scaleway Object Storage: bucket `bellanails-media` (fr-par, Private), API key (Object Storage), CORS applied, **no bucket policy** (public via per-object ACL). See [infra/scaleway/](../infra/scaleway/).
- [ ] Vercel project linked to the GitHub repo, all env vars set for Preview + Production.
- [ ] `.env.local` filled locally; `.env.example` committed (no secrets).
