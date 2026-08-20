# `modules/` — the service layer

One folder per domain: `booking`, `catalog`, `clients`, `identity`, `media`,
`notifications`, `studio`, `terms`.

A module is where a question gets answered. It picks the Supabase client (which
*is* the authorization decision), composes several `db/` calls, talks to Cal or
storage, and revalidates what changed. Pages call it and render.

## Anatomy

```
modules/<domain>/
  index.ts          the public surface — the only thing app/ imports
  reads.ts          composed reads, one per page surface
  <x>-actions.ts    "use server" mutations
  <internal>.ts     everything else — not exported from index.ts
```

Not every module needs every file. `studio` is two files; `media` is twelve.

## Rules

- **`index.ts` exports answers, not internals.** If a page needs something that
  isn't there, add a function that answers the page's question. A page importing
  three internals to assemble one view means the composition belongs here.
- **Authorization happens here, every time.** `requireOwner()` for studio
  actions, `getCurrentUser()` for a person's own data. The UI is never the
  boundary, and neither is the proxy — re-check in the action.
- **Never import a component or a page.** A type a component also needs belongs
  in `shared/`.
- **Reads that back a page degrade.** Catch, log with a surface tag, return
  empty data plus `loadError` so the page renders its error state.

## The barrel is server-only

`index.ts` reaches cookies, the service-role client and storage, so importing it
from a client component fails the build. That is why mutations live in their own
`"use server"` files: a client component imports
`@/modules/<domain>/<x>-actions` directly, never the barrel.

Anything else a client component needs — a rule, a view model, a constant —
belongs in `shared/`, not here.
