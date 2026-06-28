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
| **Supabase** | Free | Postgres + Auth bridge + Realtime + Storage(unused, Cloudinary instead) | DB, RLS, Realtime | `@supabase/supabase-js` |
| **Clerk** | Free | Authentication + user mgmt | Sign-in/up, `role` metadata, JWT for Supabase | `@clerk/nextjs` |
| **Cal.com** | Cloud Free | Scheduling | Availability, booking, reschedule/cancel URLs, webhooks | `@calcom/embed-react` |
| **Stripe** | Pay-as-you-go (no fixed fee) | No-show card holds | SetupIntents via Cal.com | (none in app — via Cal.com) |
| **Cloudinary** | Free | Media CDN | Image/video hosting + `q_auto,f_auto` transforms | unsigned/signed upload widget or REST |
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

# ── Cloudinary ──────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=   # if using unsigned widget
CLOUDINARY_API_KEY=                     # server, for signed uploads
CLOUDINARY_API_SECRET=                  # server-only

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
- Admin gating: Clerk metadata `{"role":"owner"}` checked in `proxy.ts`/layout for `/[locale]/admin`, **and** enforced again in RLS (defense in depth).

---

## Cal.com + Stripe

- Embed via `@calcom/embed-react`, `calLink` = `bellanails/session`. Theme it: `brandColor` Onyx `#121212`, `bodyBg` Alabaster `#FBFBFA`, matching fonts/radii. Pass the active language. Redirect to `/[locale]/confirmation` on success.
- Each `services.cal_event_id` maps to a Cal.com event type.
- **Webhook:** Cal.com → `POST /api/webhooks/cal`. Validate signature with `CALCOM_WEBHOOK_SECRET`. On `BOOKING_CREATED`, upsert into `bookings` (by `cal_booking_id`). Use the Supabase **service-role** client here (bypasses RLS).
- **Stripe no-show holds:** configured in Cal.com (connect Stripe, enable card hold / SetupIntent on the event type). The app stores no card data.

---

## Cloudinary

- Client-side signed upload (admin only); store the resulting **URL** in `gallery_items` / `services.image_url` — never the binary.
- Apply `q_auto,f_auto` transforms on delivery for automatic format/quality.
- Signing endpoint (if signed): a small route handler using `CLOUDINARY_API_SECRET` server-side.

---

## next-intl (⚠️ Next 16)

- Locales `['da','en']`, **default `da`**, URL path-based (`/da`, `/en`).
- Next 16 renamed middleware → **`proxy.ts`** (`export function proxy()`). Wire next-intl's locale handling there; confirm the installed next-intl version supports the `proxy` convention (or call its handler from within `proxy`).
- Messages in `messages/da.json` + `messages/en.json`, short descriptive keys (`services.gel.title`). Server-rendered to avoid flicker.
- `params` is async in pages/layouts: `const { locale } = await params`.

---

## Pre-flight checklist (accounts to create / things to have ready)

- [ ] Supabase project (URL, anon key, service-role key) + schema applied + Realtime publication.
- [ ] Clerk app (publishable + secret keys) + native Supabase integration configured + `role` metadata convention.
- [ ] Cal.com account, event type(s) matching `cal_event_id`, webhook → prod URL, signing secret, Stripe connected.
- [ ] Cloudinary account (cloud name, API key/secret, upload preset).
- [ ] Vercel project linked to the GitHub repo, all env vars set for Preview + Production.
- [ ] `.env.local` filled locally; `.env.example` committed (no secrets).
