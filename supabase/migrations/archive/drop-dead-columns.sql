-- Drop five columns the live database still carries and nothing reads.
--
-- NOT YET APPLIED. Safe — every one is verified unused by the app (grep over
-- src/ finds them only in the generated types), and `schema.sql` already omits
-- them, so applying this makes a fresh bootstrap and the live project agree.
--
-- Until it is applied, a database created from schema.sql differs from live by
-- exactly these five columns. That is harmless — no code path touches them —
-- but it is the only difference, and closing it means "clean slate" and "live"
-- are the same shape.
--
-- Regenerate src/platform/supabase/types.ts afterwards.

-- Cal.com is retired. `cal_event_id` went with booking-cal-drop.sql; the slug
-- was missed.
alter table public.services drop column if exists cal_event_slug;

-- A flag's admin copy is declared in code (`src/shared/feature-flags.ts`) so
-- every flag shows in App settings without a DB seed. The table stores only
-- each flag's on/off state, which is what `db/feature-flags.ts` selects.
alter table public.feature_flags drop column if exists category;
alter table public.feature_flags drop column if exists description;
alter table public.feature_flags drop column if exists label;
alter table public.feature_flags drop column if exists sort;
