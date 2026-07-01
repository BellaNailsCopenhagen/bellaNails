-- Realtime publication (Phase 3).
-- Realtime is off by default; add the live table(s) to the supabase_realtime
-- publication. `bookings` drives the admin queue's live updates (Phase 5).
--
-- Realtime respects RLS, so once Phase 4 lands, the subscribing client must
-- carry the Clerk token for the bookings SELECT policy to admit events.

alter publication supabase_realtime add table public.bookings;
