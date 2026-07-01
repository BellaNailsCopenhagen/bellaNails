-- Baseline RLS for Bella Nails (Phase 3).
-- Run in the Supabase SQL editor (tables already exist).
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

-- 2. Public catalog reads. Tables with archived_at expose active rows only.
create policy "Public reads active categories"
  on public.categories for select using (archived_at is null);

create policy "Public reads active services"
  on public.services for select using (archived_at is null);

create policy "Public reads active addons"
  on public.addons for select using (archived_at is null);

-- No archived_at on these — expose all rows for read.
create policy "Public reads addon incompatibilities"
  on public.addon_incompatibilities for select using (true);

create policy "Public reads assets"
  on public.assets for select using (true);

create policy "Public reads gallery items"
  on public.gallery_items for select using (true);

-- 3. bookings: no anon/authenticated policy at all → all access denied here.
--    Reads/writes go through the service-role client until Phase 4 adds the
--    Clerk-claim SELECT policy. (No policy = deny, so nothing to declare.)
