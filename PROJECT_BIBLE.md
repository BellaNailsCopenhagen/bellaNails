# Bella Nails — Project Bible

> Single source of truth for what Bella Nails is, the stack, the locked decisions, the
> data model, and the brand. Companion docs live in [`/docs`](./docs):
> [Build Plan](./docs/PLAN.md) · [Infrastructure & Setup](./docs/INFRASTRUCTURE.md).
>
> **Status:** scaffolding phase. Design system partially wired; integrations not yet installed.
> Last updated 2026-06-28.

---

## 1. What it is

**Bella Nails** is a *bilingual (Danish / English) premium nail-studio booking & management platform.*

- **Repo:** `git@github.com:BellaNailsCopenhagen/bellaNails.git` (private)
- **Local:** `/Users/raul.albu/Documents/Claude/Projects/bellaNails`
- **Goal:** 60-day MVP at **~0 DKK fixed infra cost** (free tiers throughout).
- **Two audiences:**
  - **Public / clients** — browse services, view gallery, book an appointment, manage their bookings.
  - **Owner / admin** — manage the service menu, add-ons, gallery, and view the booking queue.

---

## 2. Stack (API-orchestrated hybrid serverless)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.x** (App Router, RSC, Turbopack) | Spec said 15; we run current stable 16.2.9. ⚠️ Breaking changes vs older Next — see §7. |
| Language | **TypeScript** (strict) | `@/*` → `src/*`. |
| Package manager | **pnpm via corepack**, project-local | No global installs (hard user requirement). |
| UI | **shadcn/ui** (`base-luma` style) on **Tailwind v4** | Built on `@base-ui/react` (not Radix). `lucide-react` icons. |
| i18n | **next-intl**, URL path-based `/da` + `/en` | Danish default, server-rendered (no flicker). Keys are short & descriptive (`services.gel.title`). |
| Auth | **Clerk** (`@clerk/nextjs`) | Admin gated by Clerk metadata `{"role":"owner"}` **+** Supabase RLS. |
| Scheduling | **Cal.com** Cloud Free via `@calcom/embed-react` | `calLink: "bellanails/session"`. Invisible/native-themed embed. |
| Payments | **Stripe**, wired *through* Cal.com | No-show card holds via SetupIntents. App stores no card data. |
| Database | **Supabase Postgres** | Soft-delete via `archived_at` (never hard `DELETE`). Prices in **cents**. |
| Media | **Cloudinary** CDN | Client-side signed upload, store URL only, `q_auto,f_auto`. |
| Client data/cache | **TanStack Query v5** | Hydrated from RSC via `HydrationBoundary`. No double-fetch. |
| Live updates | **Supabase Realtime** → `invalidateQueries` | Per-table publication; respects RLS. |

**Deliberately NOT adopted:** TanStack Router/Start/Form (Next owns routing; keep existing form lib).
TanStack Table is deferred — when admin needs sort/filter/paginate, use shadcn's **data-table recipe**
(it already wraps `@tanstack/react-table`); only go lower-level if that recipe falls short.

---

## 3. Decisions locked in (by Raul)

1. **Locale slug = `/da`** everywhere (not `/dk`). `da` is the ISO 639-1 language; `dk` is a country code. Routes `/da` + `/en`, **Danish default**.
2. **DB columns use `_da`** (not `_dk`): `name_da`, `description_da`, `title_da`.
3. **Build order:** design system **FIRST** → i18n + route structure → Supabase schema → integrations.
4. **Client data layer = TanStack Query.** TanStack Table deferred (use shadcn data-table recipe). No TanStack Router/Start/Form.
5. **Folder is `bellaNails`** (capital N) — scaffolded via a temp subdir to dodge create-next-app's npm-name check, then moved up. *(Already done.)*
6. **Full stack is in scope** for MVP: Clerk auth, Stripe no-show holds, Cloudinary media — not just the core four.

---

## 4. Brand & design system — "Quiet Luxury" / "Atelier"

| Token | Value | Role |
|---|---|---|
| Onyx | `#121212` | Primary dark / CTA / Cal.com `brandColor` |
| Alabaster | `#FBFBFA` | Background / Cal.com `bodyBg` |
| Card | `#F5F3EF` | Surfaces |
| Text primary | `#1A1A19` | Body text |
| Text secondary | `#66635F` | Muted |
| Divider | `#E4E0D9` | Borders / inputs |
| Headings | **Cormorant Garamond** (serif) | `--font-editorial` |
| Body | **Plus Jakarta Sans** (sans) | `--font-functional` |

Tokens are already wired in [`src/app/globals.css`](./src/app/globals.css) (raw `--bn-*` brand values →
shadcn semantic names → Tailwind `@theme inline` utilities). Fonts are loaded via `next/font/google`
in [`src/app/layout.tsx`](./src/app/layout.tsx). Tracking scale: `tightest` (-0.02em, headlines),
`ui-button` (0.06em), `widest-lux` (0.1em, eyebrows). Radius: `sm` 2px, `fluid` 8px.

> The Cal.com embed must be themed to match (Onyx brandColor, Alabaster bg, matching fonts/radii)
> so booking feels native, not bolted-on.

---

## 5. Data model (Supabase Postgres)

Defined schema — apply with the `_da` rename. Full DDL in [Infrastructure doc](./docs/INFRASTRUCTURE.md#supabase).

| Table | Purpose | Key points |
|---|---|---|
| `services` | Service menu | `cal_event_id` UNIQUE link to Cal.com. `base_price_cents`, `base_duration_mins`. `image_url`. soft-delete. |
| `addons` | Per-service add-ons | FK `service_id`. `extra_price_cents`, `extra_duration_mins`. soft-delete. |
| `addon_incompatibilities` | Mutually-exclusive add-ons | Composite PK `(a,b)` with `CHECK (a < b)` to dedupe pairs. |
| `gallery_items` | Portfolio / before-after media | `media_type` image\|video, `display_mode` portfolio_only\|before_after, `sort_order`. UUID PK. |
| `bookings` | Archive synced from Cal.com | `cal_booking_id` UNIQUE, `clerk_user_id`, `status`, times, reschedule/cancel URLs, `total_price_cents`, `selected_addons` JSONB. |

**Conventions:** prices in **cents** (never floats); **soft-delete only** via `archived_at`; bilingual
columns paired `_en` / `_da`; bookings are the source of sync truth from the Cal.com webhook.

---

## 6. Integration flow (how the pieces talk)

```
                      ┌─────────────┐
   Client books  ───▶ │   Cal.com   │ ──BOOKING_CREATED webhook──▶ /api/webhooks/cal
   (themed embed)     │  (Cloud)    │        (signature-validated)        │
                      └─────────────┘                                     ▼
                            │  Stripe SetupIntent (no-show hold)   upsert into `bookings`
                            ▼                                             │
                         Stripe                                          ▼
                                                          Supabase Realtime emits change
   Clerk (auth) ──native 3rd-party auth──▶ Supabase RLS          │
                                                                  ▼
   RSC initial fetch ──hydrate──▶ TanStack Query ◀──invalidateQueries── realtime hook
   Cloudinary ◀── signed client upload (store URL only) ── admin gallery
```

- **Sync:** `/api/webhooks/cal` validates the signature on `BOOKING_CREATED`, then upserts into `bookings`.
- **Auth → DB:** Clerk **native Supabase third-party auth** (NOT the deprecated JWT template). RLS policies are written against Clerk claims.
- **Live:** Realtime emits *change events, not snapshots* — treat the event as a signal and `invalidateQueries` (or `setQueryData` to patch); Query refetches authoritative state.
- **App Router caveat:** invalidating Query only updates **client** components on that query — server-rendered data needs `router.refresh()`. Rule: anything that must update live (booking calendar, admin queue) lives in a **client** component backed by Query.

---

## 7. Next.js 16 gotchas (⚠️ read before coding)

This is **not** the Next.js in your training data. Confirmed breaking changes that affect this project:

- **Middleware → `proxy`.** Use `src/proxy.ts` exporting `export function proxy(request)`, not `middleware.ts`. This is where locale routing lives and **directly affects how next-intl is wired** — verify next-intl's middleware helper is compatible with the `proxy` convention (it may need the helper called from inside `proxy`).
- **`params` / `searchParams` are async** — `const { locale } = await params`. Global `PageProps<'/[locale]'>` / `LayoutProps` type helpers are available.
- **`unstable_instant`** export exists for instant client navigation (Suspense alone insufficient).
- **Always read** `node_modules/next/dist/docs/01-app/...` for the relevant feature before writing code (per AGENTS.md).

---

## 8. Current status

- ✅ Repo cloned; scaffold in place (Next 16.2.9, React 19.2.4, Tailwind v4, shadcn `base-luma`, TanStack Query installed).
- ✅ **Design system partially done:** brand tokens + fonts wired in `globals.css` / `layout.tsx`.
- ⬜ `page.tsx` still default boilerplate; `layout.tsx` metadata + `lang` still default.
- ⬜ Not yet installed: `next-intl`, `@clerk/nextjs`, `@calcom/embed-react`, `@supabase/supabase-js`, Cloudinary, Stripe.
- ⬜ No i18n routing, no `messages/*.json`, no Supabase client, no API routes, no admin.

**Next step:** finish the design system primitives, then i18n + route structure (`app/[locale]`), then apply the Supabase schema. See [Build Plan](./docs/PLAN.md).

---

## 9. Glossary

- **Invisible embed** — Cal.com embed themed so the booking UI feels native to Bella Nails.
- **Soft-delete** — rows are marked `archived_at` instead of being removed; queries filter `WHERE archived_at IS NULL`.
- **Native third-party auth** — Supabase's first-class Clerk integration (replaces the deprecated Clerk JWT template, sunset 2025-04-01).
