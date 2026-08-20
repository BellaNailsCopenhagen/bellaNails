# `db/` — the data layer

One file per table. **Every** query against a table lives in its file, so a
column list, a soft-delete filter, or a join shape has exactly one definition.

## The contract

A `db/` function:

- **takes a `Db` as its first argument.** It never builds a client. Which client
  the caller passes — anon, session-bound, or service-role — *is* the
  authorization decision, and that decision belongs to `modules/`.
- **touches one table.** If you need two, you are writing a service; put it in
  `modules/<domain>/`. (`asset-usages` and `gallery-items` read a joined `assets`
  row — that is a PostgREST embed of a foreign key, not a second query.)
- **returns schema-shaped rows**, snake_case, typed from `Row<"table">`. Mapping
  to a view model — localizing names, presigning URLs, folding in policy — is
  the module layer's job.
- **has no side effects beyond the write it names.** No `revalidatePath`, no
  notifications, no storage calls, no logging of business events.

## What must never appear here

- `requireOwner`, `getAuthUser`, or any other authorization check.
- `revalidatePath` / `revalidateTag`.
- `import "server-only"` — these functions are deliberately isomorphic. A client
  component doing a reactive read calls the same function with the browser
  client, and RLS scopes the rows.
- An import from `@/modules/**`, `@/components/**`, or `@/app/**`.

## Error handling

Reads that a page cannot render without **throw**; reads that a surface can
degrade around return an empty value. Writes return `{ ok }` (plus `message`
when the caller surfaces the reason) rather than throwing — a failed write is
usually a message to the user, not a crashed page.
