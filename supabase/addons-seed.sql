-- Add-on test catalog (Phase 6). Run in the Supabase SQL editor.
--
-- Extends add-ons across all placeholder services so the /book add-on step
-- can be exercised per service, including incompatibility behaviour. The live
-- DB already holds two addons on "Classic Manicure" (Extra Massage ⊥ Nail
-- Art) — kept as-is; this adds the rest.
--
-- ⚠️ Duration check: each service's Cal.com event type must offer duration
-- options up to base + max compatible add-on sum (15-min steps, rounded up).
-- Classic Gel Extension (90 base) with Colour+Stones = +25 → 115 → needs 120 ✓
-- already offered (90/105/120/135). Verify the other four event types cover
-- their own maxima.

begin;

insert into public.addons (service_id, name_en, name_dk, extra_price_cents, extra_duration_mins)
values
  -- Classic Gel Extension (f10f5ec6…, 90 min base) — mirrors the Figma comp.
  ('f10f5ec6-a54e-4329-bbee-bd039f7e59bc', 'Colour',      'Farve',      5000, 10),
  ('f10f5ec6-a54e-4329-bbee-bd039f7e59bc', 'French tips', 'French tips', 5000, 15),
  ('f10f5ec6-a54e-4329-bbee-bd039f7e59bc', 'Stones',      'Sten',       11000, 15),
  -- The Classic Manicure (d03f2dfb…, 45 min base)
  ('d03f2dfb-2d13-495c-8395-c81ad6448e7c', 'Colour',      'Farve',      5000, 10),
  ('d03f2dfb-2d13-495c-8395-c81ad6448e7c', 'French tips', 'French tips', 5000, 15),
  -- Shellac / BIAB (32556349…, 60 min base)
  ('32556349-8af3-41a4-a236-cee00f422f30', 'Removal',     'Fjernelse',  8000, 15),
  ('32556349-8af3-41a4-a236-cee00f422f30', 'Nail Art',    'Nail Art',   15000, 30),
  -- Gel Polish (59c02169…, 60 min base)
  ('59c02169-89a9-4d62-8884-16146dd857d7', 'Removal',     'Fjernelse',  8000, 15);

-- Incompatibilities to test the disable behaviour on two different services:
-- Gel Extension: French tips ⊥ Stones.
insert into public.addon_incompatibilities (addon_id_a, addon_id_b)
select a.id, b.id
from public.addons a
join public.addons b using (service_id)
where a.service_id = 'f10f5ec6-a54e-4329-bbee-bd039f7e59bc'
  and a.name_en = 'French tips'
  and b.name_en = 'Stones';

-- The Classic Manicure: Colour ⊥ French tips.
insert into public.addon_incompatibilities (addon_id_a, addon_id_b)
select a.id, b.id
from public.addons a
join public.addons b using (service_id)
where a.service_id = 'd03f2dfb-2d13-495c-8395-c81ad6448e7c'
  and a.name_en = 'Colour'
  and b.name_en = 'French tips';

commit;

-- Verify: 10 addons across the five services, 3 incompatibility pairs.
select s.name_en as service, a.name_en as addon, a.extra_price_cents, a.extra_duration_mins
from public.addons a
join public.services s on s.id = a.service_id
where a.archived_at is null
order by s.name_en, a.name_en;
