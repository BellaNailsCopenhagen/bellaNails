# Module boundaries

One Next.js app, one deploy — but with explicit module seams enforced by lint,
so the code stays decoupled and a future monorepo split (`packages/core`,
`apps/*`) is mechanical rather than a rewrite. We are **not** a multi-app
monorepo yet; see [`tasks/explorations/auth-ownership-and-gdpr.md`](tasks/explorations/auth-ownership-and-gdpr.md)
and [`tasks/explorations/client-pwa.md`](tasks/explorations/client-pwa.md) for
the surfaces that might one day justify one.

## The layers

| Layer | Lives in | Depends on |
| --- | --- | --- |
| **core** (domain + services) | `src/lib/**`, `src/config/**` | nothing UI — pure logic, types, integrations (Cal, Clerk, Supabase), validation |
| **admin** | `src/app/admin/**`, `src/components/admin/**`, `src/lib/admin/**` | core, shared UI |
| **web / client** | `src/app/[locale]/**`, `src/components/sections/**`, `src/components/layout/**` | core, shared UI |
| **shared UI** | `src/components/ui/**`, `src/i18n/**` | core only (leaf primitives) |

"Web" and "client" are **one app today** — the authenticated client area lives
inside the public site (the PWA exploration notes *"the client site already IS
the app"*). Split `client` out only if it becomes a separate deployable.

## Enforced rules (`eslint.config.mjs`, `no-restricted-imports`)

1. **Core stays UI-free** — `lib/**` and `config/**` may not import
   `@/components/**` or `@/app/**`. This is what keeps the domain layer
   portable into `packages/core`. Shared types belong *in* core, not in a
   component (that's why `BookingLineItem` lives in `lib/services/booking-totals`).
2. **Web/client must not import admin** — `sections/**`, `layout/**`, and
   `app/**` (excluding `app/admin`, `app/api`, `app/icons`) may not import
   `@/components/admin/**`, `@/app/admin/**`, or `@/lib/admin/**`.

The rules are verified to both fire on violations and allow legitimate
intra-module imports.

## Allowed by design

- **Admin reuses shared web components.** `admin-reschedule-embed` imports
  `sections/cal-embed-shell` (the Cal booker, shared by client booking and admin
  reschedule). Admin depending on shared UI is fine; the banned direction is
  web → admin. If `sections` grows more genuinely-shared pieces, relocate them
  to a `components/shared` (or `booking`) folder and tighten the rule.
- `app/icons` and `app/api` may use `lib/admin` — they're utility routes, not a
  client-facing surface, so they're excluded from rule 2.

## When to graduate to a real monorepo

Add workspace packages/apps only when a **second deployable** is real: the
client PWA shipping on its own cadence, a native app sharing the domain layer,
or admin needing independent deploy/scaling. Because core is already UI-free and
the surfaces don't cross-import, that split is extraction, not surgery.
