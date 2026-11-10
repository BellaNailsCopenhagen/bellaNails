-- Cal.com event-type slugs (Phase 6, step 03). Run in the Supabase SQL editor
-- BEFORE deploying the /book confirm step — the embed opens
-- cal.eu/bellanails/<cal_event_slug> and the customise/details steps read the
-- column via getServiceWithAddons.
--
-- After running, regenerate src/lib/supabase/types.ts (or verify the manual
-- addition matches):
--   pnpm dlx supabase gen types typescript --project-id <ref> --schema public

begin;

alter table public.services add column if not exists cal_event_slug text;

update public.services
set cal_event_slug = v.slug
from (
  values
    ('f10f5ec6-a54e-4329-bbee-bd039f7e59bc', 'test-gel-extension'),
    ('d03f2dfb-2d13-495c-8395-c81ad6448e7c', 'test-the-classic-manicure'),
    ('a451a773-06ac-4032-8b00-9949e03a47d0', 'test-classic-manicure'),
    ('32556349-8af3-41a4-a236-cee00f422f30', 'test-shellac-biab'),
    ('59c02169-89a9-4d62-8884-16146dd857d7', 'test-gel-polish')
) as v(id, slug)
where services.id = v.id::uuid;

commit;

-- Verify: five rows, each with its slug.
select name_en, cal_event_id, cal_event_slug
from public.services
where archived_at is null
order by cal_event_id;
