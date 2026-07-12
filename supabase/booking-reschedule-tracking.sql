-- Reschedule traceability (July 2026).
-- Cal issues a NEW bookingId+uid on every reschedule; the webhook payload's
-- `rescheduleUid` names the replaced booking. Store both uids so the chain
-- old → new is queryable in SQL, not just visible in Cal's dashboard.
--
-- Run BEFORE deploying the webhook change that writes these columns.

alter table public.bookings
  add column if not exists cal_uid text,
  add column if not exists rescheduled_from_uid text;

comment on column public.bookings.cal_uid is
  'Cal.com booking uid (stable per booking; embedded in reschedule/cancel URLs).';
comment on column public.bookings.rescheduled_from_uid is
  'cal_uid of the booking this one replaced (webhook rescheduleUid). Null unless created by a reschedule.';

-- Backfill cal_uid for existing rows from the stored cancel_url
-- (https://cal.eu/booking/<uid>?cancel=true).
update public.bookings
set cal_uid = substring(cancel_url from '/booking/([^?]+)')
where cal_uid is null;

-- Lookup path for closing out the replaced booking on reschedule.
create index if not exists bookings_cal_uid_idx on public.bookings (cal_uid);
