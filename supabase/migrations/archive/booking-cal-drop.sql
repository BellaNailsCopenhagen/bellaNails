-- Remove Cal.com entirely — drop every Cal-derived column now that booking
-- create/cancel/reschedule and availability are all in-house. Safe to run once
-- the in-house cutover is deployed (no code reads or writes these columns).
-- APPLY via the Supabase SQL editor.

alter table public.bookings
  drop column if exists cal_booking_id,
  drop column if exists cal_uid,
  drop column if exists cancel_url,
  drop column if exists reschedule_url,
  drop column if exists rescheduled_from_uid;

alter table public.services
  drop column if exists cal_event_id,
  drop column if exists cal_event_slug;
