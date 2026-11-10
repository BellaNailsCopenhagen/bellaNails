# Bella Nails — Infrastructure & Base Setup

> The concrete wiring: every external service, the accounts/keys it needs, env vars, the
> proposed folder layout, the DB DDL, and per-service gotchas. Companion to
> [docs/archive/PROJECT_BIBLE.md](../archive/PROJECT_BIBLE.md) and
> [docs/archive/PLAN.md](../archive/PLAN.md) (both historical snapshots).
>
> **Cost target: ~0 DKK** — every service below is on a free tier.

---

## Service inventory

| Service | Plan | Role | Provides | App-side install |
|---|---|---|---|---|
| **Vercel** | Hobby (free) | Hosting / CI / preview deploys | Edge + serverless runtime, env mgmt | — |
| **Supabase** | Free | Auth + Postgres + Realtime + **Storage** | Sign-in/up (Google OAuth + email OTP), `app_metadata.role`, DB, RLS, Realtime | `@supabase/supabase-js` + `@supabase/ssr` |
| **Cal.com** | Cloud Free | Scheduling | Availability, booking, reschedule/cancel URLs, webhooks | `@calcom/embed-react` |
| **Stripe** | Pay-as-you-go (no fixed fee) | No-show card holds | SetupIntents via Cal.com | (none in app — via Cal.com) |
| **next-intl** | OSS | i18n | Routing + message loading | `next-intl` |

---

## Environment variables

Create `.env.local` (git-ignored) locally and mirror in Vercel. Commit a secret-free **`.env.example`**.

```bash
# ── Supabase (DB + Auth) ────────────────────────────────
# Auth is Supabase Auth (Google OAuth + email OTP). No extra auth env vars —
# the OAuth client, OTP, and SMTP live in the Supabase Dashboard, not here.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only; never expose to client

# ── Cal.com ─────────────────────────────────────────────
NEXT_PUBLIC_CALCOM_LINK=bellanails/session
CALCOM_WEBHOOK_SECRET=              # validates /api/webhooks/cal signature

# ── Media storage ───────────────────────────────────────
# Supabase Storage — no extra vars. Reuses NEXT_PUBLIC_SUPABASE_URL +
# SUPABASE_SERVICE_ROLE_KEY above. Buckets come from supabase/storage-buckets.sql.

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
│  │  ├─ layout.tsx             # NextIntlClientProvider + Query provider; <html lang>
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
  client_id UUID NOT NULL REFERENCES clients(id),
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
CREATE INDEX idx_bookings_user ON bookings(client_id);
CREATE INDEX idx_gallery_render ON gallery_items(sort_order, display_mode);
```

### Realtime
- Off by default — add live tables (e.g. `bookings`) to the `supabase_realtime` publication.
- Realtime respects RLS: the Realtime client uses the **Supabase session** directly (native Supabase Auth), and RLS is written against `auth.jwt()` claims, to receive events on private tables.
- Non-sensitive signals (e.g. "slot taken") can use a simpler public **broadcast** channel instead.

### RLS sketch
- `services`, `addons`, `gallery_items`: public `SELECT` where `archived_at IS NULL`; writes restricted to owner.
- `bookings`: a user reads only their own (`client_id` = the caller's own client row); owner reads all (`auth.jwt() -> 'app_metadata' ->> 'role' = 'owner'`); writes via service-role in the webhook.

---

## Supabase Auth

- Auth is **Supabase Auth** — same project as the DB, no third-party JWT wiring. Sign-in methods: **Google OAuth** + **email OTP** (one-time code); no passwords, no Apple. The Google OAuth client, OTP, and the custom SMTP that sends auth emails (Zoho, host `smtp.zoho.eu`) are all configured in the **Supabase Dashboard → Authentication**, not through app env.
- RLS policies + Realtime auth key off `auth.jwt()` `app_metadata` claims from the **Supabase session** directly — no third-party JWT template, no external JWKS to fetch, so there's no auth-provider integration gotcha to hit.
- Admin gating: the owner role lives in the user's `app_metadata.role` (server-set, not user-editable) and is checked in `proxy.ts` for **`/admin`** (English-only, **not** locale-prefixed — see [tasks/admin/01-shell-auth-pwa.md](./tasks/admin/01-shell-auth-pwa.md)), **and** enforced again in RLS (defense in depth).

### Admin owner setup

`/admin` is gated to users with the `owner` role. Three things must all be true or the gate stays shut / the data stays scoped:

1. **Owner account exists.** A Supabase user for the owner's email. Preferred identity: a **named, non-public** address on the studio domain — `veronica.a@bellanails.dk` (a Zoho alias on Veronica's own mailbox is fine; **not** `hello@`, which is public). The developer's own account may also be an owner in **dev** for testing. The account can read every client's PII, so guard the mailbox accordingly.
2. **Role in `app_metadata`** — set once via **Supabase Dashboard → SQL Editor** (server-side; users can't edit their own `app_metadata`):
   ```sql
   update auth.users
     set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}'::jsonb
     where email = '<owner-email>';
   ```
   The claim surfaces as `auth.jwt() -> 'app_metadata' ->> 'role'` and backs both the `proxy.ts` gate and the RLS below. The user must sign out/in (or refresh the session) to pick it up.
3. **Owner-reads-all RLS applied** so the owner reads the whole studio, not just their own rows: apply [../supabase/admin-owner-reads.sql](../supabase/admin-owner-reads.sql) via the Supabase MCP. The gate/dashboard render without it; the count is just scoped to the owner's own bookings until it's applied.

**Verify:** sign in at `/admin` with an owner account → dashboard renders (not redirected). A signed-in non-owner → redirected to `/`.

---

## Cal.com + Stripe

- Embed via `@calcom/embed-react`, `calLink` = `bellanails/session`. Theme it: `brandColor` Onyx `#121212`, `bodyBg` Alabaster `#FBFBFA`, matching fonts/radii. Pass the active language. Redirect to `/[locale]/confirmation` on success.
- Each `services.cal_event_id` maps to a Cal.com event type.
- **Webhook:** Cal.com → `POST /api/webhooks/cal`. Validate signature with `CALCOM_WEBHOOK_SECRET`. On `BOOKING_CREATED`, upsert into `bookings` (by `cal_booking_id`). Use the Supabase **service-role** client here (bypasses RLS).
- **Stripe no-show holds:** configured in Cal.com (connect Stripe, enable card hold / SetupIntent on the event type). The app stores no card data.

---

## Media storage (Supabase Storage)

Same project as the database, so there is no second vendor and no extra key.
Design notes: [docs/tasks/design-requests/PLAN.md](tasks/design-requests/PLAN.md).
The Scaleway era is recorded in
[docs/tasks/storage-scaleway-migration.md](tasks/storage-scaleway-migration.md).

- **Three buckets**, because Supabase enforces size/MIME **per bucket**:
  `media-private` (her originals, images+video, 200 MB) · `media-refs` (a client's
  design references, images only, 5 MB) · `media-public` (published copies, world-readable).
- The area is a **prefix inside the object key**, so the bucket is derivable from
  any stored key, and an unrecognised key resolves to private — never public.

- **Private-by-default**: uploads land in a private bucket and stay there.
- **Browser upload** = the server mints a one-shot **signed upload URL** (the caller's role picks the bucket); bytes go straight to storage, never through our function.
- **Publish-on-consent** = a server-side **copy** into the public bucket. Withdraw/erase deletes the file FIRST, then its row — the row is the only thing that could retry a failed delete.
- **No RLS on `storage.objects`**, deliberately: every path is a signed grant or service-role, so the private buckets are unreachable any other way.
- **Private reads** = short-lived **presigned GET** (rendered with plain `<img>`, not `next/image`). Consented `public/` objects use the stable public URL and are allowed in `next/image`.
- **No transforms** (unlike Cloudinary): clients strip EXIF + downscale in the browser before upload (aspect ratio preserved — no crop); owner uploads (incl. demo video) are stored as-is.
- All access is via `src/platform/storage/supabase.ts` (server) and `browser.ts` (upload), env-guarded — absent config → `not_configured`, app still boots.

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
- [ ] Supabase Auth: Google OAuth + email OTP enabled, custom SMTP (`smtp.zoho.eu`) set, owner set up per **Admin owner setup** above (role in `app_metadata` + owner-reads-all RLS).
- [ ] Cal.com account, event type(s) matching `cal_event_id`, webhook → prod URL, signing secret, Stripe connected.
- [ ] Supabase Storage: run `supabase/storage-buckets.sql` (creates the three buckets with their size/MIME limits). No keys, no CORS, no policies.
- [ ] Vercel project linked to the GitHub repo, all env vars set for Preview + Production.
- [ ] `.env.local` filled locally; `.env.example` committed (no secrets).
