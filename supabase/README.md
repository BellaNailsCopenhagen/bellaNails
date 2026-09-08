# supabase/

## Starting a database — one file

```bash
psql "$DATABASE_URL" -f supabase/schema.sql        # the whole schema
psql "$DATABASE_URL" -f supabase/seed.sql          # optional dev data
psql "$DATABASE_URL" -f supabase/addons-seed.sql   # optional dev add-ons
```

`schema.sql` is the **only** file a new environment needs: 35 tables, their keys,
indexes and checks, RLS on every one, 45 policies, the helper functions, the
signup trigger on `auth.users`, and the Realtime publication.

It is generated, not hand-written — every incremental migration was replayed
against an empty Postgres in dependency order and the result dumped, then the
dump was restored into a second empty database and the catalogs diffed (662
objects, identical). See [docs/tasks/DATABASE.md](../docs/tasks/DATABASE.md).

Run it once, on an empty database. It is deliberately **not** idempotent — on a
database that already has these tables it fails on the first `create table`
rather than half-applying.

## The other files are history

Everything else in this directory is how the live database got to where it is,
kept because 26 docs cite them and because they are the record of what was
applied when. **You do not need them for a new environment**, and some are
superseded. Two warnings:

| File | |
| --- | --- |
| `outside-hours.sql` | **Never run it.** It alters `studio_hours`, which `drop-legacy-schedule.sql` dropped. It will error. Outside hours live in `schedule_rules` now. |
| `insights-months.sql` | Its header says NOT YET APPLIED. It **is** applied — the live table has rows. |

## Still to apply

| File | What |
| --- | --- |
| `gallery-surface-cleanup.sql` | Retires the `testimonial` asset surface. The delete is a no-op on live (one `asset_usages` row, surface `clients_gallery`); the value is the constraint. |
| `drop-dead-columns.sql` | Drops five columns live still carries that nothing reads. Applying it makes live and a fresh `schema.sql` bootstrap the same shape. |

## Bare Postgres

`local-postgres-shim.sql` fakes the parts of a Supabase project the schema
depends on — the three API roles, `auth.uid()`, a stub `auth.users`, the storage
schema, the Realtime publication — so you can restore and test the schema
without a Supabase project. Apply it **before** `schema.sql`. It is a test
harness, not a runtime.
