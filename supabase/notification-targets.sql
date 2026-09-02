-- What a notification is ABOUT, so tapping it lands on the item rather than the
-- top of a page. Deliberately untyped (no FK): the target is a design request, a
-- booking request or a testimonial depending on `kind`, and a dead id simply
-- degrades to the page anchor doing nothing.
-- APPLY via the Supabase SQL editor, then regenerate src/platform/supabase/types.ts.

alter table public.owner_notifications
  add column if not exists target_id uuid;
