-- Per-appointment income override (Phase 8 / admin Task 10).
--
-- The financial overview is INFO-ONLY (not accounting), so the artist can
-- correct the income recorded per appointment — refunds, partial no-show fees,
-- tips, off-system discounts. This NEVER overwrites the booked
-- `total_price_cents` (the Cal-quoted price stays the source of truth); it's a
-- separate manual figure.
--
--   effective income = income_override_cents ?? total_price_cents
--
-- `??` (not `||`): a 0 override is a real value (full refund / not charged) and
-- must not fall back to the booked price; NULL = no override.
--
-- Set by the owner-only action (service-role write). APPLY via the Supabase
-- MCP, then regenerate src/lib/supabase/types.ts.

alter table public.bookings
  add column if not exists income_override_cents integer;
