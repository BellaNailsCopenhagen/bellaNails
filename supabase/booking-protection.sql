-- How hard it is to book, and who is not allowed to.
--
-- Two things the artist owns, because both trade safety against friction on the
-- booking flow and only she can price that trade:
--   * booking_protection — one row, the access level + the human check
--   * blocked_identities — the manual blocklist for proven bad actors
--
-- Deliberately NOT feature_flags: that table stores booleans, and an escalating
-- access level is not one. Deliberately not booking_settings either — that is
-- slot arithmetic, this is abuse policy.
-- APPLY via the Supabase SQL editor, then regenerate src/platform/supabase/types.ts.

-- ─────────────────────────────────────────────── booking_protection
create table if not exists public.booking_protection (
  -- Single row, enforced by a boolean PK defaulted to true (same trick as
  -- booking_settings): a second insert collides instead of silently forking.
  id boolean primary key default true check (id),
  -- open     — any valid-looking email books
  -- verified — must confirm an email address first (the default)
  -- card     — verified AND a card on file (needs Stripe; not selectable yet)
  access_level text not null default 'verified'
    check (access_level in ('open', 'verified', 'card')),
  -- The "I'm not a robot" proof-of-work box on the booking form.
  human_check boolean not null default true,
  updated_at timestamptz not null default now()
);

GRANT SELECT ON TABLE public.booking_protection TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_protection TO authenticated;
GRANT ALL ON TABLE public.booking_protection TO service_role;

insert into public.booking_protection (id) values (true) on conflict (id) do nothing;

-- Read by the PUBLIC booking flow (it decides what the form asks for), written
-- only by the owner through a service-role action.
alter table public.booking_protection enable row level security;
drop policy if exists "Anyone reads booking protection" on public.booking_protection;
create policy "Anyone reads booking protection" on public.booking_protection
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────── blocked_identities
create table if not exists public.blocked_identities (
  id         uuid primary key default gen_random_uuid(),
  -- email  — one address, lowercased
  -- domain — everything after the @ (a disposable-inbox provider)
  -- ip     — one address, as seen by the proxy
  kind       text not null check (kind in ('email', 'domain', 'ip')),
  -- Normalised by the caller (lowercased, trimmed) so a lookup is an equality
  -- test and never a scan.
  value      text not null,
  -- Why, in her words. Not optional: a blocklist nobody can explain later is a
  -- list nobody dares remove from.
  reason     text not null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

GRANT SELECT ON TABLE public.blocked_identities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocked_identities TO authenticated;
GRANT ALL ON TABLE public.blocked_identities TO service_role;

create index if not exists blocked_identities_lookup_idx
  on public.blocked_identities (kind, value);

-- Owner-only, both ways. The public booking path checks it with the service-role
-- client, so it never needs an anon read policy — and an anon read would hand a
-- scraper the studio's blocklist.
alter table public.blocked_identities enable row level security;
drop policy if exists "Owner reads blocked identities" on public.blocked_identities;
create policy "Owner reads blocked identities" on public.blocked_identities
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
