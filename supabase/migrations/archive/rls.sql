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

-- 3. bookings: a signed-in user reads only their own rows. Clerk's session
--    token (via Supabase third-party auth) carries `sub` = the Clerk user id,
--    matched against clerk_user_id. Writes still go through the service-role
--    client (Cal.com webhook). Owner-reads-all lands with the admin shell
--    (Phase 8), keyed off the owner role claim.
create policy "Users read own bookings"
  on public.bookings for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- 4. Harden a pre-existing SECURITY DEFINER helper flagged by the advisors.
--    Postgres grants EXECUTE to PUBLIC by default, which anon/authenticated
--    inherit — so it was callable via /rest/v1/rpc. Revoke from PUBLIC (the
--    owner/postgres keeps execute for internal/trigger use).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;


-- --------------------------------------------------------------------------
-- DATA API GRANTS (Supabase change effective 2026-10-30)
-- New tables in `public` no longer get automatic Data API access. Every table
-- needs an explicit GRANT before supabase-js / PostgREST / GraphQL can reach it.
-- RLS remains the row-level security boundary; these grants only open the API gate.
-- --------------------------------------------------------------------------

GRANT SELECT ON TABLE public.addon_incompatibilities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addon_incompatibilities TO authenticated;
GRANT ALL ON TABLE public.addon_incompatibilities TO service_role;

GRANT SELECT ON TABLE public.addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addons TO authenticated;
GRANT ALL ON TABLE public.addons TO service_role;

GRANT SELECT ON TABLE public.asset_usages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asset_usages TO authenticated;
GRANT ALL ON TABLE public.asset_usages TO service_role;

GRANT SELECT ON TABLE public.assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets TO authenticated;
GRANT ALL ON TABLE public.assets TO service_role;

GRANT SELECT ON TABLE public.blocked_identities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocked_identities TO authenticated;
GRANT ALL ON TABLE public.blocked_identities TO service_role;

GRANT SELECT ON TABLE public.booking_protection TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_protection TO authenticated;
GRANT ALL ON TABLE public.booking_protection TO service_role;

GRANT SELECT ON TABLE public.booking_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_requests TO authenticated;
GRANT ALL ON TABLE public.booking_requests TO service_role;

GRANT SELECT ON TABLE public.booking_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_settings TO authenticated;
GRANT ALL ON TABLE public.booking_settings TO service_role;

GRANT SELECT ON TABLE public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;

GRANT SELECT ON TABLE public.business_profile TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_profile TO authenticated;
GRANT ALL ON TABLE public.business_profile TO service_role;

GRANT SELECT ON TABLE public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

GRANT SELECT ON TABLE public.client_consents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_consents TO authenticated;
GRANT ALL ON TABLE public.client_consents TO service_role;

GRANT SELECT ON TABLE public.client_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_media TO authenticated;
GRANT ALL ON TABLE public.client_media TO service_role;

GRANT SELECT ON TABLE public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;

GRANT SELECT ON TABLE public.communications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communications TO authenticated;
GRANT ALL ON TABLE public.communications TO service_role;

GRANT SELECT ON TABLE public.design_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_messages TO authenticated;
GRANT ALL ON TABLE public.design_messages TO service_role;

GRANT SELECT ON TABLE public.design_refs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_refs TO authenticated;
GRANT ALL ON TABLE public.design_refs TO service_role;

GRANT SELECT ON TABLE public.design_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_requests TO authenticated;
GRANT ALL ON TABLE public.design_requests TO service_role;

GRANT SELECT ON TABLE public.feature_flags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_flags TO authenticated;
GRANT ALL ON TABLE public.feature_flags TO service_role;

GRANT SELECT ON TABLE public.gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_items TO authenticated;
GRANT ALL ON TABLE public.gallery_items TO service_role;

GRANT SELECT ON TABLE public.insights_months TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insights_months TO authenticated;
GRANT ALL ON TABLE public.insights_months TO service_role;

GRANT SELECT ON TABLE public.media_releases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_releases TO authenticated;
GRANT ALL ON TABLE public.media_releases TO service_role;

GRANT SELECT ON TABLE public.notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;
GRANT ALL ON TABLE public.notes TO service_role;

GRANT SELECT ON TABLE public.offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;
GRANT ALL ON TABLE public.offers TO service_role;

GRANT SELECT ON TABLE public.owner_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.owner_notifications TO authenticated;
GRANT ALL ON TABLE public.owner_notifications TO service_role;

GRANT SELECT ON TABLE public.price_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.price_history TO authenticated;
GRANT ALL ON TABLE public.price_history TO service_role;

GRANT SELECT ON TABLE public.rate_limits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;

GRANT SELECT ON TABLE public.schedule_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedule_rules TO authenticated;
GRANT ALL ON TABLE public.schedule_rules TO service_role;

GRANT SELECT ON TABLE public.service_addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_addons TO authenticated;
GRANT ALL ON TABLE public.service_addons TO service_role;

GRANT SELECT ON TABLE public.service_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_sections TO authenticated;
GRANT ALL ON TABLE public.service_sections TO service_role;

GRANT SELECT ON TABLE public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;

GRANT SELECT ON TABLE public.terms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms TO authenticated;
GRANT ALL ON TABLE public.terms TO service_role;

GRANT SELECT ON TABLE public.terms_acceptances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms_acceptances TO authenticated;
GRANT ALL ON TABLE public.terms_acceptances TO service_role;

GRANT SELECT ON TABLE public.testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;
