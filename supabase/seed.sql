-- Development seed (Phase 3). Safe to run on a dev database; inserts one
-- category → service → add-on chain plus one gallery item. Not idempotent —
-- re-running adds duplicates (cal_event_id is unique, so a second run errors
-- on the service, which is the intended guard against double-seeding prod).

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

-- Asset → single-image gallery item.
with a as (
  insert into public.assets (url, media_type)
  values ('https://res.cloudinary.com/demo/image/upload/sample.jpg', 'image')
  returning id
)
insert into public.gallery_items (display_mode, primary_asset_id, title_en, title_dk, sort_order)
select 'single', a.id, 'Studio work', 'Studiearbejde', 1 from a;
