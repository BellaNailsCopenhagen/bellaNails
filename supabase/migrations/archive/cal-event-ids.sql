-- Attach real Cal.com event-type IDs to the services (Phase 6 prep).
-- Run in the Supabase SQL editor. Replaces the placeholder seed values.
--
-- IDs from the live cal.eu/bellanails account (July 2026), one event type per
-- service, each with multiple durations (15-min steps up to its add-on max),
-- 24h minimum notice and a 30-min after-event buffer.

begin;

-- Classic Gel Extension → cal.eu/bellanails/gel-extension
update public.services
set cal_event_id = 363871
where id = 'f10f5ec6-a54e-4329-bbee-bd039f7e59bc';

-- The Classic Manicure
update public.services
set cal_event_id = 363953
where id = 'd03f2dfb-2d13-495c-8395-c81ad6448e7c';

-- Classic Manicure
update public.services
set cal_event_id = 363957
where id = 'a451a773-06ac-4032-8b00-9949e03a47d0';

-- Shellac / BIAB
update public.services
set cal_event_id = 363961
where id = '32556349-8af3-41a4-a236-cee00f422f30';

-- Gel Polish
update public.services
set cal_event_id = 363966
where id = '59c02169-89a9-4d62-8884-16146dd857d7';

commit;

-- Verify: five rows, each with its 363xxx id.
select name_en, cal_event_id
from public.services
where archived_at is null
order by cal_event_id;
