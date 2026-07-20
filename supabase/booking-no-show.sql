-- No-show marker for bookings (Phase 8 / admin queue).
--
-- Studio-side only: `status` stays the Cal-synced lifecycle (confirmed /
-- rescheduled / cancelled), so a Cal webhook can never clobber a no-show, and
-- clients never see it. `no_show_at` is OUR marker layered on top — the instant
-- the owner marked the client a no-show (NULL = not a no-show).
--
-- Set by the owner-only action when now >= start_time + 1h (see Task 02). For
-- revenue (Task 10) a no-show earns nothing unless an income override records a
-- no-show fee.
--
-- APPLY via the Supabase MCP, then regenerate src/lib/supabase/types.ts.

alter table public.bookings
  add column if not exists no_show_at timestamptz;
