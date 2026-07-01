-- Baseline RLS for Bella Nails (Phase 3).
-- APPLIED to the live project on 2026-07-01 via the Supabase MCP. Kept here
-- as the source of record; safe to re-run except the CREATE POLICY statements
-- (which error if the policy already exists).
--
-- Model: the public catalog is world-readable (active rows only); every write
-- is denied to anon/authenticated and happens through the service-role client
-- (Cal.com webhook, owner/admin actions), which bypasses RLS.
--
-- Phase 4 (Clerk) layers on the authed policies: bookings SELECT where
-- clerk_user_id = the Clerk `sub` claim, owner reads-all, and owner writes
-- keyed off Clerk role metadata.

-- 1. Enable RLS on every table (deny-by-default once enabled).
alter table public.categories              enable row level security;
alter table public.services                enable row level security;
alter table public.addons                  enable row level security;
alter table public.addon_incompatibilities enable row level security;
alter table public.assets                  enable row level security;
alter table public.gallery_items           enable row level security;
alter table public.bookings                enable row level security;

-- 2. Public catalog reads. Scoped to the API roles (anon + authenticated)
--    rather than the broader `public` role. Tables with archived_at expose
--    active rows only.
create policy "Public reads active categories"
  on public.categories for select to anon, authenticated using (archived_at is null);

create policy "Public reads active services"
  on public.services for select to anon, authenticated using (archived_at is null);

create policy "Public reads active addons"
  on public.addons for select to anon, authenticated using (archived_at is null);

-- No archived_at on these — expose all rows for read.
create policy "Public reads addon incompatibilities"
  on public.addon_incompatibilities for select to anon, authenticated using (true);

create policy "Public reads assets"
  on public.assets for select to anon, authenticated using (true);

create policy "Public reads gallery items"
  on public.gallery_items for select to anon, authenticated using (true);

-- 3. bookings: no anon/authenticated policy at all → all access denied here.
--    Reads/writes go through the service-role client until Phase 4 adds the
--    Clerk-claim SELECT policy. (No policy = deny, so nothing to declare.)

-- 4. Harden a pre-existing SECURITY DEFINER helper flagged by the advisors.
--    Postgres grants EXECUTE to PUBLIC by default, which anon/authenticated
--    inherit — so it was callable via /rest/v1/rpc. Revoke from PUBLIC (the
--    owner/postgres keeps execute for internal/trigger use).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
