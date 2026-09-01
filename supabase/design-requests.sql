-- Design requests, their conversation, their reference photos, and the artist's
-- one-time OFFERS. See docs/tasks/design-requests/PLAN.md.
--
-- The shape in one line: a client asks (a request + a message + photos), the
-- studio answers with an offer (a duration + a price for that job), and it is
-- reached through a signed token and booked exactly like a catalog service.
--
-- Deliberately NOT a `services` row: `services` has a live unique index on
-- name, and the booking create path runs with the service role (bypassing RLS),
-- so a hidden service row would need a hand-written ownership guard. An offer
-- table keeps the catalog clean and makes the signed token the only way in.

-- ─────────────────────────────────────────────── design_requests
create table if not exists public.design_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  topic text not null check (topic in ('new_design','repair','other')),
  -- What they think they want, if they arrived from a service page.
  service_id uuid references public.services(id) on delete set null,
  -- The appointment a repair refers back to.
  booking_id uuid references public.bookings(id) on delete set null,
  -- Free text ("before the 20th") — never a slot. Requests hold no time.
  preferred_window text,
  -- Denormalised lifecycle: derivable from `offers`, but this is what the admin
  -- queue filters and indexes on, so it is stored and kept in step in one place
  -- (modules/design/offer-actions.ts).
  status text not null default 'open'
    check (status in ('open','offered','booked','declined','expired')),
  decline_reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  closed_at timestamptz
);

create index if not exists design_requests_open_idx
  on public.design_requests (created_at) where status in ('open','offered');
create index if not exists design_requests_client_idx
  on public.design_requests (client_id, created_at desc);

-- ─────────────────────────────────────────────── design_messages
-- Append-only, both directions. The client's opening message is row one.
create table if not exists public.design_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.design_requests(id) on delete cascade,
  author text not null check (author in ('client','artist')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists design_messages_request_idx
  on public.design_messages (request_id, created_at);

-- ─────────────────────────────────────────────── design_refs
-- Reference photos. Deliberately NOT `client_media`: these are usually someone
-- else's copyrighted work, they must be structurally incapable of reaching the
-- release/publish pipeline, and they have their own short retention.
create table if not exists public.design_refs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.design_requests(id) on delete cascade,
  message_id uuid references public.design_messages(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  storage_key text not null,
  storage_provider text not null default 'supabase',
  created_at timestamptz not null default now(),
  -- Swept by modules/design/refs.ts once the work is done.
  purge_after timestamptz not null default (now() + interval '90 days')
);

create index if not exists design_refs_request_idx on public.design_refs (request_id);
create index if not exists design_refs_purge_idx   on public.design_refs (purge_after);

-- ─────────────────────────────────────────────── offers
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  request_id uuid not null references public.design_requests(id) on delete cascade,
  name_en text not null,
  name_dk text,
  duration_mins integer not null check (duration_mins > 0),
  price_cents integer not null check (price_cents >= 0),
  artist_note text,
  expires_at timestamptz not null,
  -- Set when the offer produces a booking → single use.
  booking_id uuid references public.bookings(id) on delete set null,
  -- The artist pulled it back. Drives the client's message.
  withdrawn_at timestamptz,
  -- No longer live, for ANY reason (withdrawn, or expired by the sweep). Kept
  -- separate from `withdrawn_at` because the index needs one immutable column —
  -- `expires_at < now()` can't live in an index predicate — and because the
  -- client should be told "expired", not "withdrawn".
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most ONE live offer per request. Withdrawing frees the slot for a re-offer,
-- so "the current offer" is never ambiguous and the client can't book a stale one.
create unique index if not exists offers_one_live_per_request
  on public.offers (request_id) where closed_at is null and booking_id is null;
create index if not exists offers_client_idx on public.offers (client_id, created_at desc);

-- ─────────────────────────────────────────────── RLS
-- Mirrors the other client-owned tables: the owner reads everything, a signed-in
-- client reads THEIR OWN. Every write goes through a service-role server action
-- that re-verifies ownership in code — the UI is never the boundary.
alter table public.design_requests enable row level security;
alter table public.design_messages enable row level security;
alter table public.design_refs     enable row level security;
alter table public.offers          enable row level security;

drop policy if exists "Owner reads all design_requests" on public.design_requests;
create policy "Owner reads all design_requests" on public.design_requests
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own design_requests" on public.design_requests;
create policy "Clients read own design_requests" on public.design_requests
  for select to authenticated using (client_id = public.current_client_id());

drop policy if exists "Owner reads all design_messages" on public.design_messages;
create policy "Owner reads all design_messages" on public.design_messages
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own design_messages" on public.design_messages;
create policy "Clients read own design_messages" on public.design_messages
  for select to authenticated using (
    exists (
      select 1 from public.design_requests r
      where r.id = design_messages.request_id
        and r.client_id = public.current_client_id()
    )
  );

drop policy if exists "Owner reads all design_refs" on public.design_refs;
create policy "Owner reads all design_refs" on public.design_refs
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own design_refs" on public.design_refs;
create policy "Clients read own design_refs" on public.design_refs
  for select to authenticated using (client_id = public.current_client_id());

drop policy if exists "Owner reads all offers" on public.offers;
create policy "Owner reads all offers" on public.offers
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own offers" on public.offers;
create policy "Clients read own offers" on public.offers
  for select to authenticated using (client_id = public.current_client_id());

-- ─────────────────────────────────────────────── communications
-- `communications.kind` is widened in supabase/communications-kinds.sql — the
-- single authority, so re-running this file can't narrow the set again.

-- ─────────────────────────────────────────────── Realtime
-- The admin queue updates live, mirroring bookings + booking_requests.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'design_requests'
  ) then
    alter publication supabase_realtime add table public.design_requests;
  end if;
end $$;
