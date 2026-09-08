# The database — one file, and how it stays true

## The problem this solved

Fifty-odd `.sql` files in `supabase/`, applied to the live project by hand over
two months, in an order recorded nowhere. `schema.sql` was supposed to be the
fresh-start file and had drifted badly: **12 of 35 tables**, one table that had
since been retired (`media_consents`), and an internal ordering bug —
`client_media` referenced `public.bookings` seventy lines before creating it —
which means it had never once been run successfully.

So "start the database from a clean slate" was not actually possible, and we
were going to need it at go-live.

## What it is now

`supabase/schema.sql` builds the whole thing in one pass: 35 tables, 43 foreign
keys, 35 checks, 9 unique/exclusion constraints, 46 indexes, RLS on all 35
tables, 45 policies, 5 functions, the `auth.users` signup trigger, and the three
Realtime tables.

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

## How it was built — and why it can be trusted

Not by hand. Hand-merging 43 `create table`s, 101 `alter table`s and 80
`create policy`s is exactly how the old file drifted.

1. **Order recovered from git.** Each file's last-touched commit gives the real
   sequence. Ordering by *first* commit is wrong: `booking-requests.sql` was
   added on 6 Jul and rewritten on 29 Aug for Feature H, and using the July
   position reproduces the retired Clerk-era shape of that table.
2. **Replayed against an empty Postgres 15**, in that order, multi-pass — almost
   every statement is `if not exists` or `create or replace`, so passing twice
   resolves the ordering traps the individual files carry. Converged on pass 2
   at 35 tables. Excluded: the two seed files, `schema.sql` itself, and
   `outside-hours.sql` (it targets a dropped table; its net effect is nil).
3. **Dumped** with `pg_dump --schema-only`, so the file is a description of a
   database that really got built rather than an assertion about one.
4. **Restored into a second empty database** and the two catalogs diffed —
   columns with types, nullability and defaults, index definitions, policy
   `USING`/`WITH CHECK` expressions, constraint definitions, RLS flags, function
   bodies, publication membership, triggers. **662 objects, identical.**
5. **Diffed against the live project** through PostgREST's OpenAPI spec — the
   authoritative live column list. Same 35 tables, same 297 columns bar five
   (below).

Two things `pg_dump --schema=public` does not carry, added back by hand and
covered by step 4's diff: the `on_auth_user_created` trigger, which lives on
`auth.users` — lose it and a sign-in creates no `clients` row — and the Realtime
publication membership.

## The five columns live has and the file doesn't

Verified unused by the app (they appear in `src/` only inside the generated
types):

| Column | Why it's dead |
| --- | --- |
| `services.cal_event_slug` | Cal.com is retired; `booking-cal-drop.sql` dropped `cal_event_id` and missed the slug. |
| `feature_flags.category` `.description` `.label` `.sort` | A flag's admin copy is declared in `src/shared/feature-flags.ts` so every flag appears in App settings with no DB seed. The table holds only on/off state. |

`supabase/drop-dead-columns.sql` closes the gap. Until it is applied a fresh
bootstrap differs from live by exactly these five, which is harmless — nothing
reads them — but applying it makes "clean slate" and "live" the same shape.
Regenerate `src/platform/supabase/types.ts` after.

## Keeping it true

The trap is obvious: the next migration makes this file stale, silently, and in
a month we are back where we started.

- **A new migration is still a new file** in `supabase/` — that stays the record
  of what was applied to live, and when.
- **Then fold it in.** Re-run the procedure above, or just add the statement to
  the right section of `schema.sql` and re-verify with the restore-and-diff.
- **The verification is the point**, not the file. It takes about a minute:

```bash
docker run -d --name bn-db -e POSTGRES_PASSWORD=x -e POSTGRES_DB=bn \
  -p 55432:5432 postgres:15.3-alpine3.18
psql "postgres://postgres:x@localhost:55432/bn" -f supabase/local-postgres-shim.sql
psql "postgres://postgres:x@localhost:55432/bn" -v ON_ERROR_STOP=1 -f supabase/schema.sql
# 35 tables, all with RLS:
psql "postgres://postgres:x@localhost:55432/bn" -tAc \
  "select count(*)||' tables, all RLS: '||bool_and(rowsecurity) from pg_tables where schemaname='public'"
docker rm -f bn-db
```

If `schema.sql` restores clean on an empty database with `ON_ERROR_STOP=1`, it
works. That is the whole test, and the old file would have failed it.
