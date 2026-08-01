-- Asset usage registry — where a shared image is actually placed. Granting
-- publish consent does NOT auto-place an image anywhere; the artist assigns
-- use-cases here, so usage is explicit, flexible, and trackable. Rows cascade
-- away when the asset is removed (withdraw/erase), so nothing dangles.
-- APPLY via the Supabase SQL editor / MCP, then regenerate types.ts.

create table if not exists public.asset_usages (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  surface    text not null check (surface in (
    'clients_gallery', 'showcase', 'some', 'testimonial'
  )),
  url        text,                              -- e.g. the social post link
  created_at timestamptz not null default now(),
  unique (asset_id, surface)
);
create index if not exists asset_usages_asset_id_idx
  on public.asset_usages (asset_id);
create index if not exists asset_usages_surface_idx
  on public.asset_usages (surface);

-- Public reads (a surface page renders its assets); writes are service-role.
alter table public.asset_usages enable row level security;
create policy "Public reads asset usages"
  on public.asset_usages for select to anon, authenticated using (true);
