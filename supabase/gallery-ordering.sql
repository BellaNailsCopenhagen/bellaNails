-- Gallery homepage ordering guardrails.
-- APPLIED manually to the live project via Supabase SQL editor / MCP.
--
-- Rules:
-- - `sort_order` defaults to null, so gallery items are not featured on the
--   homepage unless explicitly assigned a slot.
-- - Only values 1..5 are allowed.
-- - Each slot can be used at most once, which means no more than five items
--   can be featured at the same time.

alter table public.gallery_items
  alter column sort_order drop default;

alter table public.gallery_items
  alter column sort_order set default null;

alter table public.gallery_items
  drop constraint if exists gallery_items_sort_order_range;

alter table public.gallery_items
  add constraint gallery_items_sort_order_range
  check (sort_order is null or sort_order between 1 and 5);

create unique index if not exists gallery_items_featured_sort_order_key
  on public.gallery_items (sort_order)
  where sort_order is not null;
