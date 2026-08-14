-- Price history for the catalog. A row is appended whenever a service's base
-- price or an add-on's extra price is set (on create and on every change), so
-- the admin edit dialog can show how a price moved over time.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

create table if not exists public.price_history (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('service', 'addon')),
  entity_id   uuid not null,
  price_cents integer not null,
  changed_at  timestamptz not null default now()
);
create index if not exists price_history_entity_idx
  on public.price_history (entity_type, entity_id, changed_at desc);

-- Internal-only. Reads + writes both go through the service-role client
-- (getPriceHistory / recordPrice via requireOwner), which bypasses RLS — that's
-- the real gate. This owner-only SELECT policy is defense-in-depth so no direct
-- anon/authenticated query can read price history.
alter table public.price_history enable row level security;
create policy "Owner reads price history"
  on public.price_history for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
