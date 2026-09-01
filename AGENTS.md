# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Architecture: four layers, one direction

```
app → modules → db → platform
```

Never skip a layer, never reverse. Full reference: [`docs/architecture.md`](docs/architecture.md).

| Directory | What it is | Rule |
| --- | --- | --- |
| `src/app/**` | Routes. Params, metadata, rendering. | A page asks a module **one question per concern**. It never builds a Supabase client. |
| `src/modules/<domain>/` | Service layer. Authorization, composition, side effects, `"use server"` actions. | `index.ts` is the public surface. Never imports a component. |
| `src/db/<table>.ts` | Data layer. One file per table. | Takes `db: Db` first. One table. No auth, no revalidation. |
| `src/platform/**` | Vendor adapters (Supabase incl. Storage, Zoho SMTP). | The only files that know a vendor's name. |
| `src/shared/**` | Pure, isomorphic rules + view models. | No vendor, no service, no UI. **Anything a client component needs lives here.** |
| `src/components/<area>/` | UI used by 2+ routes. | Single-use UI lives in the route's `_components/` instead. |

Domains: `booking` `catalog` `clients` `design` `identity` `media` `notifications` `studio` `terms` `testimonials`

## Rules lint will enforce (all are errors)

1. **`.from("table")` only inside `src/db/**`.** Need a query? Add a function to `src/db/<table>.ts` and call it.
2. `db/` may not import `modules/`, `components/`, `app/`, `hooks/`.
3. `modules/` may not import `components/` or `app/`.
4. `shared/` may not import `modules/`, `platform/`, `components/`, `app/`.
5. `page.tsx` / `layout.tsx` / `error.tsx` / `loading.tsx` / `not-found.tsx` may not import `db/` or `platform/`. A route renders; it does not fetch.
6. `components/` may not import a module barrel **by value** (`import type` is fine — it is erased).
7. `hooks/`, `components/`, `app/**/_components/` may not build a server Supabase client.
8. `hooks/` may not import a module barrel by value (a hook is always browser code).

In `app/**/_components/` the barrel ban is enforced by the **build**, not lint — that folder mixes server and client components and a path glob can't see `"use client"`. A Turbopack error naming `next/headers` means a client component reached a server-only module.

## The client/server trap

A module barrel is **transitively server-only** (cookies, service-role, storage). A client component importing one fails the Turbopack build. From a client component:

- mutation → `@/modules/<domain>/<x>-actions` (each is `"use server"`)
- rule / view model / constant → `@/shared/*`
- reactive read → `@/db/*` (isomorphic, RLS-scoped, takes the browser client)
- a type → `import type` from anywhere

`db/` is deliberately **not** `server-only`. RLS is the boundary.

## Adding a feature

1. New query → `src/db/<table>.ts`.
2. Composing / authorizing / side effect → `src/modules/<domain>/`. Mutations in `*-actions.ts` (`"use server"`); page-backing reads in `reads.ts`.
3. Export from the module's `index.ts` **as the answer to a question**, not as an internal.
4. The page calls that one function and renders.
5. New UI → the route's `_components/`. Promote to `src/components/` when a second route uses it.

## Conventions

- `db/` returns schema-shaped rows (snake_case, `Row<"table">`); modules map to view models. Use the generated `Insert<"table">` / `Update<"table">` for payloads.
- `db/` reads a page can't render without throw; ones it can degrade around return empty. Writes return `{ ok, message? }`. Module reads that back a page catch and return `loadError`.
- ~200 lines is a smell threshold, not a cap. Exceptions: generated types, vendored `components/ui` primitives, and `db/<table>.ts` for a busy table.
- Comments say **why**, in one line. A long explanation means the naming or structure needs work.

## Before committing

Run the real thing and check the real exit code — never pipe `pnpm run build` into grep:

```
npx tsc --noEmit && pnpm run lint && pnpm run build
```
