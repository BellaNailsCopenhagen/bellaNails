# Unified schedule — one calendar for working / outside / no-work hours

**Status: BUILT** (unmerged; SQL pending — `supabase/schedule-rules.sql`). The
`schedule_rules` table + rules engine (`shared/schedule.ts` `dayRanges`/`standardDay`)
+ the visual week editor (`app/admin/hours/_components/schedule-*.tsx`) are done, with
the availability engine and conflict check rewired onto them. Editor decisions (Raul):
**visual week + tap-to-add** (mobile = day-tabs), **explicit outside blocks** (no global
window). Deferred polish + the model's additive-only limitation are in
[FOLLOWUPS.md](../FOLLOWUPS.md). The original plan is kept below for reference.

## The goal (Raul)

Redefine `/admin/hours` into ONE calendar view where the artist defines, as time
slots on a day:

- **standard** working hours (normal self-service booking)
- **outside** hours (client can only *request* — artist approves)
- **no-work** (never bookable)

Each slot is **recurring** (weekly) or **one-time** (a date). They can layer on
the same day and must resolve with a clear hierarchy applied *everywhere*.
Interaction like Google Calendar: click a day, drag a start–end, pick the type,
pick recurring vs one-time.

## Proposed data model — `schedule_rules` (replaces today's split)

Today the schedule is spread over `studio_hours.weekly`, `studio_hours.no_work`,
`studio_hours.outside_window_*`, and `studio_special_days`. Collapse all of it
into one table:

```
schedule_rules
  id          uuid pk
  kind        text  check ('standard' | 'outside' | 'no_work')
  weekday     smallint null   -- 0..6 (Mon..Sun) for a RECURRING rule
  on_date     date null       -- a specific date for a ONE-TIME rule
  start_time  text            -- "HH:MM" studio-local
  end_time    text            -- "HH:MM"
  label       text null
  created_at  timestamptz default now()
  check ( (weekday is null) <> (on_date is null) )   -- exactly one recurrence
```

A full-day off = a `no_work` rule 00:00–24:00 (recurring weekday, or one date).
"Closed" is simply "no `standard` rule that day".

## Hierarchy (applied in the engine, one place)

`no_work` > `standard` > `outside`. Per day D (weekday W):

1. Gather rules where `weekday = W` OR `on_date = D`, grouped by kind.
2. `standardBookable = union(standard) − union(no_work)`
3. `outsideRequestable = union(outside) − union(no_work) − union(standard)`
   (a time that's standard is booked normally, never offered as a request)

`getAvailableSlots` feeds on `standardBookable`; `getOutsideHoursSlots` on
`outsideRequestable`. The pure range math already exists
(`shared/studio-hours.ts`: `complementRanges` / `subtractRanges`) — this swaps
`effectiveRangesForDayNumber` to resolve from rules instead of the two WeeklyHours
blobs + the outer window.

## Calendar editor (the UI)

- A **week view** (reuse the admin agenda's week scaffolding) with the studio's
  bookings shown read-only underneath, so the artist edits hours against real
  appointments.
- **Click-drag** a start–end on a day → a small event modal: **type**
  (standard / outside / no-work), **recurrence** (this weekday every week / just
  this date), optional label → save one `schedule_rule`.
- **Layered rendering**: standard (solid), outside (hatched), no-work (muted/striped)
  — legible when they overlap the same hours.
- Existing rules are editable/removable inline.

## Migration (no prod data → clean)

Drop `studio_hours.weekly/no_work/outside_window_*` usage + `studio_special_days`
in favour of `schedule_rules`; seed from the current values (weekly → standard
rules, no_work → no_work rules, special closed → one-time no_work, special hours →
one-time standard). Keep the `outside_hours_enabled` flag (still a single studio
setting). Rewire `availability.ts`, `getOutsideHoursSlots`, the conflict check,
and `getStudioHours` (public "open today").

## Conflict check — BUILT ✅

`modules/studio/conflicts.ts::getScheduleConflicts` — after any schedule save
(weekly hours, outside/no-work, special day) the editor shows a **non-blocking**
warning listing future bookings that no longer fit: client · date · time · reason
(`in a no-work block` / `outside working hours` / `on a now-closed day`). Nothing
is cancelled; the artist reschedules from the queue. This carries over unchanged
to the `schedule_rules` model (it already resolves via `effectiveRangesForDayNumber`).

## Why planned, not built blind

The calendar editor is a large, subjective UX overhaul that (1) replaces the hours
system we just shipped, (2) needs Raul's eyes before merge regardless, and (3)
goes wrong when built without iterative review. A solid plan + the conflict check
delivered now is worth more than a fragile blind build. Pick this up together.

## Rough effort
- schema + seed migration: **S**
- engine rewire (resolve from rules): **M**
- calendar editor UI: **L** (the bulk)
- conflict check: **done**
