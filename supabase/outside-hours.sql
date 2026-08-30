  -- Outside-hours requests — all HOURS/availability config lives on studio_hours
  -- (next to weekly + special), so the artist's schedule is one table. Additive;
  -- safe to re-run.
  --
  --   no_work               : weekly blocked intervals (WeeklyHours shape,
  --                           weekday → [["12:00","13:00"], …]) carved out of BOTH
  --                           normal and outside-hours slots.
  --   outside_hours_enabled : the client-facing "request outside hours" flag.
  --   outside_window_*       : the outer window a request may fall in.

  alter table public.studio_hours
    add column if not exists no_work jsonb not null default '{}'::jsonb,
    add column if not exists outside_hours_enabled boolean not null default false,
    add column if not exists outside_window_start text not null default '06:00',
    add column if not exists outside_window_end text not null default '20:00';
  