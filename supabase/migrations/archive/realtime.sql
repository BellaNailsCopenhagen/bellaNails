-- Realtime publication (Phase 3).
-- APPLIED to the live project on 2026-07-01 via the Supabase MCP.
--
-- Realtime is off by default; add the live table(s) to the supabase_realtime
-- publication. `bookings` drives the admin queue's live updates (Phase 5).
--
-- ⚠️ DORMANT UNTIL PHASE 4: Realtime enforces RLS per subscriber, and
-- `bookings` currently has RLS enabled with no policy (deny-all). So no
-- anon/authenticated subscriber receives events yet — only a service-role
-- (RLS-bypassing) subscriber would. This becomes observable once Phase 4 adds
-- the Clerk-claim SELECT policy and the client subscribes with the Clerk token.

-- Idempotent add (ALTER PUBLICATION ... ADD TABLE errors if already a member).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
