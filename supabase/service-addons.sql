-- Task 03b — add-ons become standalone, reusable catalog items linked to
-- services many-to-many (a "Removal" add-on shared across services). APPLY via
-- the Supabase MCP, then regenerate src/lib/supabase/types.ts (the hand-added
-- types mirror this). See docs/tasks/admin/03-services-crud.md.
--
-- The legacy `addons.service_id` is kept (nullable) for rollback; reads now go
-- through `service_addons`. New add-ons are created without a service_id and
-- linked via the join.

create table if not exists public.service_addons (
  service_id uuid not null references public.services(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, addon_id)
);
create index if not exists service_addons_addon_id_idx
  on public.service_addons (addon_id);

-- Backfill the join from the legacy one-to-many link.
insert into public.service_addons (service_id, addon_id)
  select service_id, id
  from public.addons
  where service_id is not null
on conflict do nothing;

-- RLS: public reads the join (like the catalog); writes are service-role.
alter table public.service_addons enable row level security;
create policy "Public reads service addons"
  on public.service_addons for select to anon, authenticated using (true);
