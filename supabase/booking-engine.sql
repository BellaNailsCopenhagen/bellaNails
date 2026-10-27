-- In-house booking engine — Phase 1 (additive, non-breaking; Cal still runs).
-- Adds the global scheduling rules Cal.com used to hold, and the DB-level
-- double-booking guarantee. Availability itself = studio_hours (already applied).
-- APPLY via the Supabase SQL editor.

-- 1. Booking settings: a single config row of global scheduling rules. Public-
--    read (the client booking flow reads it to generate slots); writes are
--    service-role (owner). Seed with sensible defaults — owner-editable.
create table if not exists public.booking_settings (
  id                 boolean primary key default true,
  slot_interval_mins integer not null default 30,   -- granularity of offered start times
  buffer_mins        integer not null default 15,    -- gap kept after each booking
  min_lead_mins      integer not null default 1440,  -- earliest you can book (24 h)
  max_advance_days   integer not null default 60,    -- furthest ahead you can book
  updated_at         timestamptz not null default now(),
  constraint booking_settings_singleton check (id),
  constraint booking_settings_positive check (
    slot_interval_mins > 0 and buffer_mins >= 0
    and min_lead_mins >= 0 and max_advance_days > 0
  )
);

GRANT SELECT ON TABLE public.booking_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_settings TO authenticated;
GRANT ALL ON TABLE public.booking_settings TO service_role;

insert into public.booking_settings (id) values (true) on conflict (id) do nothing;

alter table public.booking_settings enable row level security;
create policy "Public reads booking settings"
  on public.booking_settings for select to anon, authenticated using (true);

-- 2. Double-booking guarantee: no two ACTIVE bookings may overlap in time. The
--    DB is the boundary (createBooking relies on catching this), not app checks.
--    Single-resource studio (one chair) — if resources are added later, extend
--    the constraint with `resource_id with =`. Statuses mirror
--    shared/booking-status.ts ACTIVE_BOOKING_STATUSES (confirmed, rescheduled).
create extension if not exists btree_gist;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (tstzrange(start_time, end_time) with &&)
  where (status in ('confirmed', 'rescheduled'));
