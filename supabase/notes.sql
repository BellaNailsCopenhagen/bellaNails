-- Artist notes — private admin-authored notes on a client or a booking. Never
-- client-facing: the artist alone reads/writes them. A booking shows its own
-- notes plus the client's client-level notes (booking_id null = client-level).
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete cascade, -- null = client-level
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notes_client_id_idx on public.notes (client_id);
create index if not exists notes_booking_id_idx on public.notes (booking_id);

-- Owner-only: RLS is ENABLED with NO policy, so anon + authenticated clients are
-- denied entirely. The studio reads/writes via the service-role client (which
-- bypasses RLS), so these notes never reach a client.
alter table public.notes enable row level security;
