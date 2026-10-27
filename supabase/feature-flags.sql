-- App feature flags — the on/off STATE of each flag. The flags themselves are
-- declared in code (src/shared/feature-flags.ts), which is the source of truth
-- for what exists + its admin label/description, so the settings list needs no
-- seed. This table just persists whether each flag is on; a row appears the first
-- time a flag is toggled (upsert by key). Replaces the lone
-- studio_hours.outside_hours_enabled boolean.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.
--
-- APPLY ORDER: run schedule-rules.sql FIRST (its seed still reads studio_hours +
-- studio_special_days). Only AFTER both are applied + verified is it safe to drop
-- the now-dead studio_hours + studio_special_days tables.

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

GRANT SELECT ON TABLE public.feature_flags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_flags TO authenticated;
GRANT ALL ON TABLE public.feature_flags TO service_role;

-- Public read (the booking flow checks flags); writes are service-role (admin).
alter table public.feature_flags enable row level security;
drop policy if exists "Public reads feature flags" on public.feature_flags;
create policy "Public reads feature flags"
  on public.feature_flags for select to anon, authenticated using (true);
