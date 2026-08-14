-- Service content sections: ordered image + text blocks that make up a
-- service's "Learn more" detail page. The image references a public `assets`
-- row — either a consented client photo picked from the shared gallery, or a
-- fresh studio upload published to the public bucket.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

create table if not exists public.service_sections (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  sort_order integer not null default 0,
  title_en   text,
  title_dk   text,
  body_en    text,
  body_dk    text,
  asset_id   uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists service_sections_service_idx
  on public.service_sections (service_id, sort_order);

-- Public reads (the service detail page renders them); writes are service-role.
alter table public.service_sections enable row level security;
create policy "Public reads service sections"
  on public.service_sections for select to anon, authenticated using (true);
