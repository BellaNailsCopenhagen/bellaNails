-- Studio working hours — the source of truth for opening times (public "hours",
-- and the availability denominator for the in-house scheduler + Insights).
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

-- JSONB shape guards (the DB refuses malformed data regardless of who writes;
-- the server action still validates for friendly errors). CASE-guarded so a
-- wrong jsonb type can't error the check.

-- An array of ["HH:MM","HH:MM"] pairs, each open before close. null allowed.
-- The is-not-null checks force FALSE (not NULL) on a missing element, so a
-- one-element pair is rejected; (p->2) is null bounds the upper end at two.
create or replace function public.is_hour_ranges(v jsonb)
  returns boolean language sql immutable set search_path = public as $$
  select case
    when v is null then true
    when jsonb_typeof(v) = 'array' then not exists (
      select 1 from jsonb_array_elements(v) p
      where not (
        jsonb_typeof(p) = 'array'
        and (p->2) is null                    -- at most two elements
        and (p->>0) is not null               -- at least two elements
        and (p->>1) is not null
        and (p->>0) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (p->>1) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (p->>0) < (p->>1)                 -- open before close
      )
    )
    else false
  end;
$$;

-- An object whose every value is a valid hour-ranges array.
create or replace function public.is_weekly_hours(w jsonb)
  returns boolean language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(w) = 'object' then not exists (
      select 1 from jsonb_each(w) e where not public.is_hour_ranges(e.value)
    )
    else false
  end;
$$;

drop table if exists public.studio_hours;
-- Regular weekly hours: a single config row. `weekly` maps a weekday key to an
-- array of [start, end] time pairs (pairs allow a split day, e.g. a lunch break);
-- an absent day = closed. Times are local "HH:MM" strings.
--   { "mon": [["10:00","18:00"]], "sat": [["10:00","14:00"]] }
create table if not exists public.studio_hours (
  id         boolean primary key default true,
  weekly     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint studio_hours_singleton check (id),
  constraint studio_hours_weekly_valid check (public.is_weekly_hours(weekly))
);
insert into public.studio_hours (id, weekly)
values (true, '{}'::jsonb)
on conflict (id) do nothing;

drop table if exists public.studio_special_days;

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
  created_at timestamptz not null default now(),
  constraint studio_special_days_hours_valid check (public.is_hour_ranges(hours))
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
