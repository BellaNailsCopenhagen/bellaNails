-- In-house booking writes — relax the Cal-only NOT NULLs so createBooking can
-- insert an in-house booking without them. Cal still sets them until the /book
-- UI swaps; all Cal columns are dropped entirely once Cal is removed (Phase 3c).
-- APPLY via the Supabase SQL editor.
alter table public.bookings
  alter column cal_booking_id drop not null,
  alter column cancel_url drop not null,
  alter column reschedule_url drop not null;
