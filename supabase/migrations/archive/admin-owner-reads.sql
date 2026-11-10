-- Owner-reads-all on bookings (Phase 8 / admin Task 01).
-- Additive to "Users read own bookings" (supabase/rls.sql): the owner sees
-- EVERY booking so the admin queue/dashboard can read the whole studio day,
-- while regular clients keep seeing only their own rows.
--
-- APPLY to the live project via the Supabase MCP, then regenerate
-- src/lib/supabase/types.ts if the schema surface changed.
--
-- The owner is identified by a role claim in the Clerk session token, mapped
-- from user.public_metadata.role in the Clerk dashboard. It surfaces in the
-- JWT under `metadata.role` (same claim the proxy /admin gate reads). Writes
-- stay service-role only (Cal webhook + admin server actions).

create policy "Owner reads all bookings"
  on public.bookings for select
  to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
