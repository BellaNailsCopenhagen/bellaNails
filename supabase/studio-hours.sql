-- Studio working hours — the source of truth for opening times (public "hours",
-- and the availability denominator for the in-house scheduler + Insights).
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

-- Regular weekly hours: a single config row. `weekly` maps a weekday key to an
-- array of [start, end] time pairs (pairs allow a split day, e.g. a lunch break);
-- an absent day = closed. Times are local "HH:MM" strings.
--   { "mon": [["10:00","18:00"]], "sat": [["10:00","14:00"]] }
create table if not exists public.studio_hours (
  id         boolean primary key default true,
  weekly     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint studio_hours_singleton check (id)
);
insert into public.studio_hours (id, weekly)
values (true, '{}'::jsonb)
on conflict (id) do nothing;

-- Special days: one-off overrides on top of the weekly schedule — either CLOSED
-- (Easter, a vacation range) or open with special `hours`. A range is starts_on
-- → ends_on inclusive (ends_on null = a single day).
create table if not exists public.studio_special_days (
  id         uuid primary key default gen_random_uuid(),
  starts_on  date not null,
  ends_on    date,
  closed     boolean not null default true,
  hours      jsonb,             -- [["12:00","16:00"]] when open with special hours
  label      text,              -- "Easter", "Summer holiday"
  created_at timestamptz not null default now()
);
create index if not exists studio_special_days_starts_on_idx
  on public.studio_special_days (starts_on);

-- Opening hours are public info (shown on the site, read by the booking flow);
-- writes are service-role (admin).
alter table public.studio_hours enable row level security;
create policy "Public reads studio hours"
  on public.studio_hours for select to anon, authenticated using (true);

alter table public.studio_special_days enable row level security;
create policy "Public reads studio special days"
  on public.studio_special_days for select to anon, authenticated using (true);
