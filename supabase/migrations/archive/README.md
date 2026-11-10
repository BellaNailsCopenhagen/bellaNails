# Archived migrations

Incremental SQL migrations kept as the history of how the live database got to
its current shape. **You do not need these for a new environment** — `supabase/schema.sql`
is the consolidated source of truth (35 tables, keys, indexes, checks, RLS, 45
policies, helper functions, signup trigger, Realtime publication).

Apply `schema.sql` once on an empty database. It is deliberately **not**
idempotent.

## Warnings

| File | Note |
|------|------|
| `outside-hours.sql` | **Never run it.** It alters `studio_hours`, which `drop-legacy-schedule.sql` dropped. It will error. Outside hours live in `schedule_rules` now. |
| `insights-months.sql` | Header says NOT YET APPLIED, but it **is** applied — the live table has rows. |

## Still to apply (on live, if desired)

| File | What |
|------|------|
| `gallery-surface-cleanup.sql` | Retires the `testimonial` asset surface. |
| `drop-dead-columns.sql` | Drops five columns live still carries that nothing reads. |

These are archived, not deleted — run them deliberately when you're ready.
