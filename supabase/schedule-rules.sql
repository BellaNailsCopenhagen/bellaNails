-- Unified schedule — ONE table for standard / outside / no-work times, each a
-- recurring weekday rule or a one-time dated rule. Fully replaces the legacy
-- studio_hours (weekly / no_work / outside_window_*) + studio_special_days; the
-- outside-hours toggle moved to feature_flags. Those legacy tables are read ONCE
-- by the seed below, then dropped by drop-legacy-schedule.sql.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

create table if not exists public.schedule_rules (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('standard', 'outside', 'no_work')),
  weekday     smallint check (weekday between 0 and 6),  -- 0=Mon..6=Sun (recurring)
  on_date     date,                                       -- a single date (one-time)
  start_time  text not null,                              -- "HH:MM" studio-local
  end_time    text not null,                              -- "HH:MM" studio-local
  label       text,
  created_at  timestamptz not null default now(),
  -- exactly one recurrence: a weekday rule OR a dated rule, never both/neither.
  constraint schedule_rules_recurrence check ((weekday is null) <> (on_date is null)),
  constraint schedule_rules_time_valid check (
    start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and start_time < end_time
  )
);
create index if not exists schedule_rules_weekday_idx on public.schedule_rules (weekday);
create index if not exists schedule_rules_on_date_idx on public.schedule_rules (on_date);

-- Public reads (the booking flow + public hours); writes are service-role (admin).
alter table public.schedule_rules enable row level security;
drop policy if exists "Public reads schedule rules" on public.schedule_rules;
create policy "Public reads schedule rules"
  on public.schedule_rules for select to anon, authenticated using (true);

-- SEED (runs only when schedule_rules is empty). Converts the legacy tables into
-- rules so an existing schedule carries over — each read is guarded by to_regclass
-- so this file also applies cleanly on a fresh DB (no legacy tables → empty seed).
-- A full-day block is 00:00–23:59 (the tail minute is never a bookable slot).
-- Nothing is seeded for `outside` (the old outer-window had no explicit blocks) or
-- for special-OPEN days (the additive model can't reproduce "replace the day").
do $$
begin
  if exists (select 1 from public.schedule_rules) then
    return;
  end if;

  if to_regclass('public.studio_hours') is not null then
    -- weekly hours → recurring standard rules
    insert into public.schedule_rules (kind, weekday, start_time, end_time)
    select 'standard',
           case day.key when 'mon' then 0 when 'tue' then 1 when 'wed' then 2
                        when 'thu' then 3 when 'fri' then 4 when 'sat' then 5
                        when 'sun' then 6 end,
           pair->>0, pair->>1
    from public.studio_hours sh,
         jsonb_each(sh.weekly) as day(key, ranges),
         jsonb_array_elements(day.ranges) as pair
    where sh.id = true
      and day.key in ('mon','tue','wed','thu','fri','sat','sun');

    -- no-work blocks → recurring no_work rules
    insert into public.schedule_rules (kind, weekday, start_time, end_time)
    select 'no_work',
           case day.key when 'mon' then 0 when 'tue' then 1 when 'wed' then 2
                        when 'thu' then 3 when 'fri' then 4 when 'sat' then 5
                        when 'sun' then 6 end,
           pair->>0, pair->>1
    from public.studio_hours sh,
         jsonb_each(sh.no_work) as day(key, ranges),
         jsonb_array_elements(day.ranges) as pair
    where sh.id = true
      and day.key in ('mon','tue','wed','thu','fri','sat','sun');
  end if;

  -- special CLOSED days → one-time full-day no_work (per date in the range).
  if to_regclass('public.studio_special_days') is not null then
    insert into public.schedule_rules (kind, on_date, start_time, end_time, label)
    select 'no_work', d::date, '00:00', '23:59', sd.label
    from public.studio_special_days sd,
         generate_series(sd.starts_on, coalesce(sd.ends_on, sd.starts_on),
                         interval '1 day') d
    where sd.closed;
  end if;
end $$;
