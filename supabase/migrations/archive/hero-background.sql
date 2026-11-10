-- The hero background: the picture (or the film) behind the landing statement.
--
-- It was a file in the repo, `/assets/hero_image.jpg`, so changing the first
-- thing anyone sees meant a code change and a deploy. This is one key in the
-- PUBLIC media bucket, uploaded through the admin, exactly like map_image_key.
--
-- ONE column, not two: whether it is a photo or a film is read from the file
-- extension, which the presign route writes from the content type. A separate
-- `kind` column would be a second answer to a question the key already answers,
-- and the two would eventually disagree.
--
-- Empty falls back to the image shipped with the app, so the hero always has
-- something behind it — before this row exists, before storage is configured,
-- and if the key ever fails to resolve.
--
-- APPLY via the Supabase SQL editor, then update src/platform/supabase/types.ts.

alter table public.business_profile
  add column if not exists hero_asset_key text;
