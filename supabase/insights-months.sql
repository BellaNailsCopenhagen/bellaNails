-- Monthly insight snapshots.
--
-- Of everything on this screen, exactly ONE figure cannot be worked out again
-- afterwards: how many hours the studio was open. Income, booked time and counts
-- all come from the bookings and can be recomputed any day; open hours come from
-- the schedule, and the schedule is a live thing the artist edits. Recompute a
-- past month against today's week and a three-day winter is divided by a six-day
-- spring — it reads as a collapse that never happened.
--
-- So `open_mins` is CAPTURED while the month is current, and never touched
-- again. NULL means we weren't watching that month (it ended before this table
-- existed, or she didn't open the screen during it) — the app shows no
-- percentage rather than a wrong one.
--
-- Everything else is a cache, and `stale` says when it needs rebuilding: an
-- income correction or a no-show marked on a past appointment changes the money
-- but not the hours, so the row is rebuilt around the `open_mins` it already has.
--
-- NOT YET APPLIED. Apply via the Supabase SQL editor, then regenerate
-- src/platform/supabase/types.ts.

create table if not exists public.insights_months (
  -- year*12 + (month-1) — sortable, comparable, the same key the app uses.
  month_key    integer primary key,
  appointments integer not null default 0,
  -- How many of those carry an income figure the artist set by hand.
  adjusted     integer not null default 0,
  income_cents bigint  not null default 0,
  booked_mins  integer not null default 0,
  -- The month's open minutes as they were. NULL = unknown, show no percentage.
  open_mins    integer,
  -- The money needs rebuilding; the hours above still stand.
  stale        boolean not null default false,
  computed_at  timestamptz not null default now()
);

GRANT SELECT ON TABLE public.insights_months TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insights_months TO authenticated;
GRANT ALL ON TABLE public.insights_months TO service_role;

alter table public.insights_months enable row level security;

-- Studio-wide aggregate: amounts and minutes, no client, nothing identifying.
-- Still owner-only — it is the studio's own business, not a public figure.
drop policy if exists "Owner reads insights months" on public.insights_months;
create policy "Owner reads insights months" on public.insights_months
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

-- Writes are service-role only (the app maintains these; nobody edits by hand).
