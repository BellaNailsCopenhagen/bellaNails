# Architecture

One Next.js app, four layers. The flow is always

```
app → modules → db → platform
```

never skipping a layer and never reversing. Every rule below follows from that
one sentence, and all eight are enforced in `eslint.config.mjs`.

## The layers

| Layer | Lives in | Owns | Never |
| --- | --- | --- | --- |
| **routes** | `src/app/**` | Params, metadata, rendering. Asks a module one question per concern. | Builds a client. Imports `db/` or `platform/`. |
| **services** | `src/modules/<domain>/**` | Authorization, composition across tables, external calls, revalidation, `"use server"` actions. | Imports a component. |
| **data** | `src/db/<table>.ts` | Queries for one table. Column lists, soft-delete filters, embed shapes. | Authorization. Revalidation. A second table. |
| **platform** | `src/platform/**` | Vendor adapters: Supabase clients + generated types, Supabase Storage, Zoho SMTP. | Knows a table name or a domain concept. |

Two supporting directories sit outside that stack:

- **`src/shared/**`** — the isomorphic floor. Pure rules, view models and
  helpers that a server action and a browser component can both run
  (`booking-policy`, `booking-view`, `studio-time`, `media-policy`). No vendor,
  no service, no UI. This is where anything a client component needs must live.
- **`src/components/**`** — UI shared by two or more routes. Single-use UI lives
  with its route (below).

## The domains

`booking` · `catalog` · `clients` · `identity` · `media` · `notifications` ·
`studio` · `terms`

Each is one folder under `src/modules/` with an `index.ts` that states its
public surface. If a page needs something not exported there, **add a function
that answers the page's question** — do not export an internal.

## Where UI goes

A component used by exactly one route lives in that route's `_components/`
folder (`src/app/[locale]/book/_components/`). Next.js ignores
underscore-prefixed folders, so this changes nothing about routing.

Membership is transitive: if `booking-steps` is only used by
`booking-step-header`, which is only used by `/book`, the whole cluster belongs
to `/book`.

A component used by two or more routes goes in `src/components/<area>/` —
`ui` (primitives), `layout`, `booking`, `gallery`, `legal`, `admin`, `auth`.

**When a second route starts using a co-located component, move it to
`components/`.** That is the moment it became shared — not before.

## The client/server seam

This is the rule that is easiest to get wrong, and the build will stop you.

A module barrel (`@/modules/booking`) is **transitively server-only**: it
reaches cookies, the service-role client and storage. A client component that
imports one drags all of that into the browser bundle, and Turbopack fails the
build with an import trace.

So, from a client component:

| You need | Import |
| --- | --- |
| a mutation | `@/modules/<domain>/<x>-actions` (each is `"use server"`) |
| a rule, a view model, a constant | `@/shared/*` |
| a reactive read | `@/db/*` — isomorphic, RLS-scoped, takes the browser client |
| a type from a module | `import type` — erased, so it is allowed |

`db/` is deliberately **not** `server-only`. RLS is the boundary: the same
function runs on the server with the session client and in a client component
with the browser client, and Postgres decides what each may see.

## Enforced rules

`eslint.config.mjs`, each verified to fire on a real violation:

1. `.from("table")` outside `src/db/**` is an error.
2. `db/` may not import `modules/`, `components/`, `app/`, `hooks/`.
3. `modules/` may not import `components/` or `app/`.
4. `shared/` may not import `modules/`, `platform/`, `components/`, `app/`.
5. `page.tsx` / `layout.tsx` / `error.tsx` / `loading.tsx` / `not-found.tsx` may
   not import `db/` or `platform/`.
6. `components/` may not import a module barrel *by value* (type-only is fine).
7. `hooks/`, `components/` and `app/**/_components/` may not build a server
   Supabase client.
8. `hooks/` may not import a module barrel by value (a hook is always browser
   code, so the ban is unconditional there).

Route handlers (`route.ts`) are exempt from rule 5 — an API endpoint is a
backend surface, and two of them (`api/auth/callback`, `api/media/sign`) are
pure platform plumbing.

**Where lint stops and the build takes over.** A co-located `_components/`
folder holds server *and* client components, and a path glob cannot see the
`"use client"` directive — so the barrel ban (rule 6) is not applied there. For
those files the Turbopack build is the enforcer, and it is the stronger check:
it walks the whole import graph and prints the offending trace. If you see
*"You're importing a module that depends on next/headers"*, a client component
reached a server-only module — follow the table above.

## Conventions

**Error handling.** `db/` reads that a page cannot render without throw; reads a
surface can degrade around return empty. `db/` writes return `{ ok }` (plus
`message` when the caller surfaces the reason). Module reads that back a page
catch and return a `loadError` flag, so the page renders its error state
instead of crashing.

**Shapes.** `db/` returns schema-shaped rows (snake_case, typed from
`Row<"table">`). Mapping to a view model — localizing names, presigning URLs,
folding in policy — is the module layer's job. Insert/update payloads use the
generated `Insert<"table">` / `Update<"table">` types rather than hand-written
ones, so a schema change is a type error rather than a runtime surprise.

**File size.** ~200 lines is a smell threshold, not a cap: crossing it means
"check whether this file is doing two jobs". Deliberate exceptions are
`platform/supabase/types.ts` (generated), the vendored `components/ui`
primitives, and `db/<table>.ts` for a busy table — a table's whole query surface
in one place is the readability this buys.

**Naming.** `db/` functions say what they fetch (`listBookingsForClient`,
`getBookingLifecycle`). Module reads say what surface they answer
(`getAdminQueue`, `getMySpace`). Actions say what they do to the world
(`cancelBooking`, `requestMediaPublish`).

## Adding a feature

1. **Does a table need a new query?** Add it to `src/db/<table>.ts`. First
   argument `db: Db`, one table, no auth, no revalidation.
2. **Does it need composing, authorizing, or a side effect?** Add it to
   `src/modules/<domain>/`. Mutations go in a `*-actions.ts` file with
   `"use server"`; reads that back a page go in `reads.ts`.
3. **Export it from the module's `index.ts`** — as the answer to a question, not
   as an internal.
4. **The page calls that one function** and renders. If the page is
   orchestrating several calls, the composition belongs in step 2.
5. **New UI goes in the route's `_components/`** until a second route needs it.

## Monorepo, later

Because `db/`, `modules/`, `platform/` and `shared/` are already UI-free and the
dependency direction is enforced, extracting a `packages/core` is a move, not a
rewrite. Do it only when a second deployable is real — the client PWA on its own
cadence, a native app, or admin needing independent deploys. See
`tasks/explorations/client-pwa.md`.
