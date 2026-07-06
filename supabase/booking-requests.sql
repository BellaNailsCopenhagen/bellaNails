-- Out-of-hours booking requests (Phase 8).
-- Source of record — apply to the live project via the Supabase SQL editor / MCP.
--
-- A booking_request is "a client wants a slot" — typically outside normal
-- availability (currently anything but Saturday), which Cal.com won't offer
-- self-service. The artist reviews it, agrees a time, creates the Cal.com
-- booking (host-created, out-of-hours via the API), and links it here; the
-- confirmed row still lands in `bookings` through the existing Cal.com webhook.
--
-- Identity model: client PII (email/name) lives in Clerk. We store only the
-- pseudonymous `clerk_user_id` (the webhook / request flow create-or-find a
-- Clerk user by email), so this table holds no personal data.

-- 1. updated_at helper. SECURITY INVOKER (default) + empty search_path per the
--    Supabase advisor guidance for mutable-search-path functions.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Table.
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  services jsonb not null,
  est_duration_mins integer,
  est_price_cents integer,
  preferred_times jsonb,
  note text,
  status text not null default 'pending'
    check (status in (
      'pending', 'accepted', 'declined', 'scheduled', 'cancelled', 'expired'
    )),
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_requests_clerk_user_id_idx
  on public.booking_requests (clerk_user_id);
create index if not exists booking_requests_status_idx
  on public.booking_requests (status);

drop trigger if exists set_booking_requests_updated_at on public.booking_requests;
create trigger set_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

-- 3. RLS. Mirrors `bookings`: a signed-in user reads/creates only their own
--    rows (keyed off the Clerk `sub` claim); all admin state transitions run
--    through the service-role client (bypasses RLS). Owner-reads-all lands with
--    the admin shell (Phase 8), same as bookings.
alter table public.booking_requests enable row level security;

drop policy if exists "Users read own booking requests" on public.booking_requests;
create policy "Users read own booking requests"
  on public.booking_requests for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

drop policy if exists "Users create own pending booking requests" on public.booking_requests;
create policy "Users create own pending booking requests"
  on public.booking_requests for insert
  to authenticated
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and status = 'pending'
    and booking_id is null
  );

-- 4. Realtime — let the admin request queue update live (mirrors `bookings`).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_requests'
  ) then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;
