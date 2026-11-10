-- Services-menu categorization (Phase 7). Run in the Supabase SQL editor.
--
-- Restructures the catalog into the three-category menu the /services page
-- renders: Classic Manicure → Shellac & BIAB → Gel Extensions. Shellac IS
-- gel polish (a brand of it), so both live in one category; BIAB is grouped
-- there too as a natural-nail strengthening overlay; sculpted extensions
-- stand alone.
--
-- NOTE, not handled here: the catalog holds two near-duplicate pairs —
-- "Classic Manicure" (350 kr) vs "The Classic Manicure" (320 kr) and
-- "Gel Polish" (450 kr) vs "Shellac / BIAB" (420 kr). Both members of each
-- pair are assigned below; archive the stale one (set `archived_at = now()`)
-- once the owner decides which prices are real.

-- Category images: the menu page renders a 3:4 portrait per category when
-- `image_url` is set. Until curated photos land in Cloudinary, all three
-- reuse the hero image — the same temporary approach as the homepage gallery.
-- Swap for `https://res.cloudinary.com/.../q_auto,f_auto/...` URLs when ready.

begin;

-- 1. Repurpose the existing "Manicures" category as Classic Manicure, slot 1.
update public.categories
set
  name_en        = 'Classic Manicure',
  name_dk        = 'Klassisk Manicure',
  description_en = 'Natural nail care — shaping, cuticle work, hand massage and a polished finish. The foundation every other treatment builds on.',
  description_dk = 'Pleje af de naturlige negle — form, neglebåndsarbejde, håndmassage og en poleret finish. Fundamentet, alle andre behandlinger bygger på.',
  image_url      = '/assets/hero_image.jpg',
  sort_order     = 1
where id = '56465527-d966-4f47-87b4-fe2f571c0834';

-- 2. New categories: Shellac & BIAB (slot 2), Gel Extensions (slot 3).
insert into public.categories (name_en, name_dk, description_en, description_dk, image_url, sort_order)
values
  (
    'Shellac & BIAB',
    'Shellac & BIAB',
    'Long-wear gel polish cured under LED, and BIAB — builder in a bottle — to strengthen the natural nail. Chip-resistant colour for up to three weeks.',
    'Langtidsholdbar gellak hærdet under LED, og BIAB — builder in a bottle — der styrker den naturlige negl. Slidstærk farve i op til tre uger.',
    '/assets/hero_image.jpg',
    2
  ),
  (
    'Gel Extensions',
    'Geleforlængelse',
    'Sculpted hard-gel length and structure, built by hand over a form and refined to a natural profile.',
    'Skulpturel længde og struktur i hård gel, bygget i hånden over en form og forfinet til en naturlig profil.',
    '/assets/hero_image.jpg',
    3
  );

-- 3. Assign every service to its category.
-- Classic Manicure ← "The Classic Manicure" ("Classic Manicure" already there).
update public.services
set category_id = '56465527-d966-4f47-87b4-fe2f571c0834'
where id = 'd03f2dfb-2d13-495c-8395-c81ad6448e7c';

-- Shellac & BIAB ← "Gel Polish" + "Shellac / BIAB".
update public.services
set category_id = (select id from public.categories where name_en = 'Shellac & BIAB')
where id in (
  '59c02169-89a9-4d62-8884-16146dd857d7',
  '32556349-8af3-41a4-a236-cee00f422f30'
);

-- Gel Extensions ← "Classic Gel Extension".
update public.services
set category_id = (select id from public.categories where name_en = 'Gel Extensions')
where id = 'f10f5ec6-a54e-4329-bbee-bd039f7e59bc';

commit;
