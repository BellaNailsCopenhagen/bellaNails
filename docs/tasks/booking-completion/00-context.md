# Booking Completion — Shared Context (read first)

> **Every task in this folder assumes you've read this file.** It captures the
> conventions, environment, and decisions the four tasks share so each brief
> stays short. Design rationale lives in the spec (`booking-completion-spec.md`,
> held by the owner); the phased roadmap is in [`../../PLAN.md`](../../PLAN.md);
> the "why" is in [`../../../PROJECT_BIBLE.md`](../../../PROJECT_BIBLE.md).

## What this group delivers

The client booking loop end-to-end: **Step 03 (Cal.com embed)** → **webhook + identity sync** → **/confirmation** → **/bookings**. Steps 01 (Customise) and 02 (Your details) already exist under `/book`; step 02's confirm button is deliberately `disabled` pending Step 03.

Dependency order (respect it):

```
01 step03-embed ─┐
                 ├─▶ 03 confirmation
02 webhook ──────┤
                 └─▶ 04 bookings
```

01 can be built and visually tested alone. 02 is the data foundation for 03 and 04.

## ⚠️ Next.js 16 — not the version in your training data

Read `AGENTS.md` and the relevant guide under `node_modules/next/dist/docs/01-app/...` **before writing code**. Confirmed differences that bite here:

- Middleware is `src/proxy.ts` exporting `proxy` — **not** `middleware.ts`. It already composes `clerkMiddleware` + next-intl. Don't add a second middleware.
- `params` and `searchParams` are **async** — `const { locale } = await params`.
- Prefer the global `PageProps<'/[locale]/...'>` type helpers where available.

## Repo map (what to reuse, never rebuild)

| Need | Use |
|---|---|
| Page shell | `src/app/[locale]/<route>/page.tsx` — pattern below |
| Layout primitives | `Container`, `Section` (`src/components/layout/container.tsx`) |
| Editorial page intro | `PageHeader` (`src/components/ui/page-header.tsx`) — eyebrow + 2-line display + intro |
| Step indicator | `BookingSteps` (`src/app/[locale]/book/_components/booking-steps.tsx`) — `current` is `0 | 1 | 2` |
| Running total card | `AppointmentSummary` (`src/components/booking/appointment-summary.tsx`), `BookingLineItem` type |
| Prices | `PriceTag` (`src/components/ui/price-tag.tsx`) — cents in, `locale` prop, `sign` for deltas |
| Buttons / inputs | `src/components/ui/{button,input,textarea,label,checkbox,separator,badge}.tsx` |
| Localized link/redirect | `@/i18n/navigation` (`Link`, `redirect`) — never `next/link` for locale routes |
| Route constants | `@/config/routes` (`routes.book`, `routes.bookings`, `routes.signIn`, …) |
| Supabase (public reads) | `createSupabaseServerClient()` (`src/platform/supabase/server.ts`) |
| Supabase (authed / RLS) | `createAuthedSupabaseServerClient()` (same file) |
| Supabase (service-role, webhook only) | service-role client in `server.ts` (`server-only`) — **never import into a client/RSC render path** |
| DB types | `src/platform/supabase/types.ts` (generated) |
| Service+addons fetch | `getServiceWithAddons(id)` (`getServiceWithAddons` in `src/modules/catalog`) |

### Canonical page pattern

```tsx
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "<ns>" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <main className="flex flex-1 flex-col">{/* section component */}</main>;
}
```

Keep page files thin; put single-use UI in the route's `_components/` and shared UI in `src/components/`.

## Data conventions (do not deviate)

- **Localized columns use the `_dk` suffix** (not `_da`) + `_en`. The `da` locale maps to `_dk`. Resolve with `pickLocalized(locale, en, dk)` (`src/shared/localized.ts`).
- **Prices in cents** (`base_price_cents`, `extra_price_cents`, `total_price_cents`). Never floats. Render only via `PriceTag`.
- **Soft-delete** via `archived_at` — reads filter `WHERE archived_at IS NULL`. Never hard-delete.
- `bookings` columns: `cal_booking_id` (unique), `clerk_user_id`, `status` (`confirmed|rescheduled|cancelled`), `start_time`, `end_time`, `reschedule_url`, `cancel_url`, `total_price_cents`, `selected_addons` (jsonb).
- RLS is already applied: *"Users read own bookings"* = `(select auth.jwt()->>'sub') = clerk_user_id`. `bookings` writes are service-role only.

## Cal.com — EU instance (critical)

The account is on the **EU** data center. Everything points at EU, not `cal.com`:

- Booking URLs: `cal.eu/bellanails/<slug>` · API base: `api.cal.eu` · API version header: `cal-api-version: 2024-06-14`.
- Env: `NEXT_PUBLIC_CALCOM_LINK` (EU), `CALCOM_WEBHOOK_SECRET`, `CALCOM_API_KEY` (server-only). See `.env.example`.
- Five event types seeded; each service row has `cal_event_id`. Only the **main service** event type is sent to Cal — add-ons have no Cal identity; the app computes total price + duration and picks a slot length.
- **Duration rounds UP** to the nearest offered 15-min step (over-reserve ≤14 min is fine; under-reserving collides bookings). Non-standard durations (105/135) exist only via API v2 `lengthInMinutesOptions`.

## Auth / identity model (decided)

- Sign-in methods = **email code + Google + Apple** (all on Clerk free plan). Use Clerk's **prebuilt** `<SignIn/>`/`<SignUp/>` (already brand-themed via `@clerk/ui` shadcn theme + `@clerk/localizations` daDK/enUS) so the UI mirrors dashboard config — don't hand-build provider buttons.
- Clients are keyed to Clerk by **`clerk_user_id`**; **no client PII in our DB** — name/email/phone live in Clerk.
- **We own the Clerk profile write** (Task 02): create-or-find by email, fill-if-empty (never clobber). The Cal webhook is only the *booking* sync.

## Clerk dashboard checklist (owner action — not code)

- [ ] Sign-in methods enabled: email code, Google, Apple.
- [ ] **Verified-email account linking ON** — so a booking-created user + a later Google/Apple sign-in on the same email resolve to one identity (no duplicate, no split history).
- [ ] Backend API key present for the server action (`CLERK_SECRET_KEY`).

## Relevant vendored skills (`.agents/skills/`)

- `clerk-backend-api` — create-or-find user, update profile (Task 02).
- `clerk-nextjs-patterns` — `references/api-routes.md`, `references/server-actions.md`, `references/server-vs-client.md` (Tasks 02–04).
- `clerk-custom-ui` — only if a custom flow is ever needed; default to prebuilt components.
- Supabase MCP (`.mcp.json`) — for schema checks / type regen.

## Task brief template (each file follows this)

**Goal · Depends on · In scope (files) · Out of scope · Acceptance criteria · Verification · Relevant skills.**

## House rules

- **Preview before applying:** show the diff / proposed code and wait for the owner's OK before writing source. (Owner requirement.)
- One branch/PR per task; name it `feat/booking-<task>` to match existing `feat/*` branches.
- Add i18n keys to **both** `messages/da.json` and `messages/en.json`; keys are type-checked (`src/global.d.ts`) so a missing key fails the build.
- Run `pnpm lint` + `pnpm build` (green) before opening the PR. pnpm is project-local via corepack — no global installs.
