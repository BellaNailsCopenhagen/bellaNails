-- Development seed (Phase 3). NOT applied to the live project (it already has
-- sample rows) — kept for fresh/dev databases.
--
-- Wrapped in a single transaction so it's atomic: on a re-run the featured
-- service's unique `cal_event_id` (1001) raises, the whole transaction rolls
-- back, and no partial/orphan rows (category, asset, gallery item) are left
-- behind. That's the intended guard against double-seeding.

begin;

-- Category → featured service → add-on.
with cat as (
  insert into public.categories (name_en, name_dk, description_en, description_dk, sort_order)
  values ('Manicure', 'Manicure', 'Hand care & gel', 'Håndpleje & gel', 1)
  returning id
),
svc as (
  insert into public.services (
    category_id, cal_event_id, name_en, name_dk,
    description_en, description_dk, base_price_cents, base_duration_mins, is_featured
  )
  select cat.id, 1001, 'Classic Gel Extension', 'Klassisk Gelforlængelse',
         'Long-wear, mirror-finish gel.', 'Langtidsholdbar gel med spejlfinish.',
         65000, 90, true
  from cat
  returning id
)
insert into public.addons (service_id, name_en, name_dk, extra_price_cents, extra_duration_mins)
select svc.id, 'French tips', 'French tips', 5000, 15 from svc;

-- Asset → temporary five-tile gallery preview using one reused image asset.
with a as (
  insert into public.assets (url, media_type)
  values ('/assets/hero_image.jpg', 'image')
  returning id
)
insert into public.gallery_items (display_mode, primary_asset_id, title_en, title_dk, sort_order)
select
  'single',
  a.id,
  v.title_en,
  v.title_dk,
  v.sort_order
from a
cross join (
  values
    ('Studio detail', 'Studiedetalje', 1),
    ('Elegant finish', 'Elegant finish', 2),
    ('Mirror shine', 'Spejlglans', 3),
    ('Signature set', 'Signatursæt', 4),
    ('Bella Nails look', 'Bella Nails-look', 5)
) as v(title_en, title_dk, sort_order);

commit;
