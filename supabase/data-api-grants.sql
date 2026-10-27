-- ============================================================================
-- Supabase Data API grants — all tables (one file to run everywhere)
-- ============================================================================
--
-- Supabase change effective 2026-10-30: new tables in `public` no longer get
-- automatic Data API access. Every table needs an explicit GRANT before
-- supabase-js / PostgREST / GraphQL can reach it, otherwise the API returns
-- "permission denied".
--
-- This file is idempotent and safe to re-run against any environment — new
-- project, preview branch, or after `supabase db reset`. Tables that don't
-- exist yet (e.g. `studio_hours` / `studio_special_days` after
-- `drop-legacy-schedule.sql`) are skipped via `to_regclass()`.
--
-- RLS remains the row-level security boundary. These grants only open the API
-- gate; writes still go through service-role server actions, and RLS policies
-- enforce the actual read/write boundary per role.
--
-- Tables are granted:
--   anon            → SELECT (public reads; RLS restricts rows)
--   authenticated   → SELECT, INSERT, UPDATE, DELETE (RLS restricts rows)
--   service_role    → ALL (bypasses RLS; used by webhooks and admin actions)
--
-- Note: `testimonials` keeps its column-level SELECT grant for `anon`
-- (id, author_name, occupation, body, sort_order, submitted_at) in
-- supabase/testimonials.sql — table-level SELECT would widen that, so it is
-- intentionally skipped here.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.addon_incompatibilities') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.addon_incompatibilities TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addon_incompatibilities TO authenticated;
    GRANT ALL ON TABLE public.addon_incompatibilities TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.addons') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.addons TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addons TO authenticated;
    GRANT ALL ON TABLE public.addons TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.asset_usages') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.asset_usages TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asset_usages TO authenticated;
    GRANT ALL ON TABLE public.asset_usages TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.assets') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.assets TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets TO authenticated;
    GRANT ALL ON TABLE public.assets TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.blocked_identities') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.blocked_identities TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocked_identities TO authenticated;
    GRANT ALL ON TABLE public.blocked_identities TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.booking_protection') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.booking_protection TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_protection TO authenticated;
    GRANT ALL ON TABLE public.booking_protection TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.booking_requests') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.booking_requests TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_requests TO authenticated;
    GRANT ALL ON TABLE public.booking_requests TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.booking_settings') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.booking_settings TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_settings TO authenticated;
    GRANT ALL ON TABLE public.booking_settings TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.bookings TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
    GRANT ALL ON TABLE public.bookings TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.business_profile') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.business_profile TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_profile TO authenticated;
    GRANT ALL ON TABLE public.business_profile TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.categories TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
    GRANT ALL ON TABLE public.categories TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.client_consents') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.client_consents TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_consents TO authenticated;
    GRANT ALL ON TABLE public.client_consents TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.client_media') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.client_media TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_media TO authenticated;
    GRANT ALL ON TABLE public.client_media TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.clients TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
    GRANT ALL ON TABLE public.clients TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.communications') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.communications TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communications TO authenticated;
    GRANT ALL ON TABLE public.communications TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.design_messages') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.design_messages TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_messages TO authenticated;
    GRANT ALL ON TABLE public.design_messages TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.design_refs') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.design_refs TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_refs TO authenticated;
    GRANT ALL ON TABLE public.design_refs TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.design_requests') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.design_requests TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_requests TO authenticated;
    GRANT ALL ON TABLE public.design_requests TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.feature_flags TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_flags TO authenticated;
    GRANT ALL ON TABLE public.feature_flags TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.gallery_items') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.gallery_items TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_items TO authenticated;
    GRANT ALL ON TABLE public.gallery_items TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.insights_months') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.insights_months TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insights_months TO authenticated;
    GRANT ALL ON TABLE public.insights_months TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.media_releases') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.media_releases TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_releases TO authenticated;
    GRANT ALL ON TABLE public.media_releases TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.notes TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;
    GRANT ALL ON TABLE public.notes TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.offers') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.offers TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;
    GRANT ALL ON TABLE public.offers TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.owner_notifications') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.owner_notifications TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.owner_notifications TO authenticated;
    GRANT ALL ON TABLE public.owner_notifications TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.price_history') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.price_history TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.price_history TO authenticated;
    GRANT ALL ON TABLE public.price_history TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.rate_limits TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO authenticated;
    GRANT ALL ON TABLE public.rate_limits TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.reviews TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;
    GRANT ALL ON TABLE public.reviews TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.schedule_rules') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.schedule_rules TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedule_rules TO authenticated;
    GRANT ALL ON TABLE public.schedule_rules TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.service_addons') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.service_addons TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_addons TO authenticated;
    GRANT ALL ON TABLE public.service_addons TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.service_sections') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.service_sections TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_sections TO authenticated;
    GRANT ALL ON TABLE public.service_sections TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.services TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.services TO authenticated;
    GRANT ALL ON TABLE public.services TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.studio_hours') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.studio_hours TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_hours TO authenticated;
    GRANT ALL ON TABLE public.studio_hours TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.studio_special_days') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.studio_special_days TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_special_days TO authenticated;
    GRANT ALL ON TABLE public.studio_special_days TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.terms') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.terms TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms TO authenticated;
    GRANT ALL ON TABLE public.terms TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.terms_acceptances') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.terms_acceptances TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms_acceptances TO authenticated;
    GRANT ALL ON TABLE public.terms_acceptances TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO authenticated;
    GRANT ALL ON TABLE public.testimonials TO service_role;
  END IF;
END $$;