-- Booking requests — a client asks for a slot the self-service flow won't grant:
--   outside_hours → client picks an ideal date + preferred time (NOT guaranteed)
--   over_limit    → past the 2-active cap; they already picked a real slot
-- The artist reviews in the admin, may adjust the time, then ACCEPTS (creates a
-- real booking, bypassing limits) or REJECTS (with a reason). No prod data, and
-- the old starter was Clerk/Cal-era (clerk_user_id) — drop and recreate on
-- client_id, matching the in-house model.

drop table if exists public.booking_requests cascade;

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('outside_hours','over_limit')),
  -- The requested (ideal) window. over_limit = the slot the client picked;
  -- outside_hours = ideal date + preferred time, adjustable by the artist.
  start_time timestamptz not null,
  end_time timestamptz not null,
  -- Same meta blob as bookings.selected_addons (serviceId, addonIds, snapshot
  -- names, totalDurationMins) so display + accept reuse the booking helpers.
  selected_addons jsonb not null default '{}'::jsonb,
  total_price_cents integer not null default 0,
  -- Client's optional free-text note (PII — deleted on erasure).
  message text,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected')),
  booking_id uuid references public.bookings(id) on delete set null,
  reject_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

GRANT SELECT ON TABLE public.booking_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_requests TO authenticated;
GRANT ALL ON TABLE public.booking_requests TO service_role;

create index booking_requests_pending_idx
  on public.booking_requests (created_at) where status = 'pending';
create index booking_requests_client_idx
  on public.booking_requests (client_id);

alter table public.booking_requests enable row level security;
-- Owner reads all; a client reads their own. Writes go through service-role
-- actions (the create flow is public-by-email, like createBooking).
drop policy if exists "Owner reads all booking_requests" on public.booking_requests;
create policy "Owner reads all booking_requests" on public.booking_requests
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own booking_requests" on public.booking_requests;
create policy "Clients read own booking_requests" on public.booking_requests
  for select to authenticated using (client_id = public.current_client_id());

-- Realtime so the admin request section updates live (mirrors bookings).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'booking_requests'
  ) then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;
