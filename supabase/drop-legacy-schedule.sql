-- Cleanup — drop the legacy schedule tables, now fully replaced:
--   studio_hours.weekly / no_work           → schedule_rules (standard / no_work)
--   studio_hours.outside_window_*           → explicit `outside` rules
--   studio_hours.outside_hours_enabled      → feature_flags (outside_hours_requests)
--   studio_special_days                     → dated schedule_rules
--
-- RUN LAST — only AFTER schedule-rules.sql (its seed migrates data FROM these
-- tables) and feature-flags.sql are applied and the new schedule is verified.
-- This is irreversible; nothing in the codebase reads these tables anymore.

drop table if exists public.studio_special_days;
drop table if exists public.studio_hours;

-- JSONB guard functions used only by those tables' check constraints.
drop function if exists public.is_weekly_hours(jsonb);
drop function if exists public.is_hour_ranges(jsonb);
