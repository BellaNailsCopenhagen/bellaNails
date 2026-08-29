-- Media releases — booking-level permission to use a client's media in marketing.
-- Replaces the per-image `media_consents` ledger (dropped below; no prod data).
--
-- One row per (booking, purpose): the client's documented, withdrawable consent
-- (GDPR Art. 6(1)(a)) to use ALL photos + videos from that appointment for the
-- stated purpose. Consent is the CEILING; the artist still curates which specific
-- shots get published. Per-asset publication lives in `assets` (public copy) and
-- `asset_usages` (placement) — see below.
--
-- Purpose vocabulary (informed, granular — Danish law wants consent specific per
-- purpose, and the website vs social split gates the public site):
--   website   → our own website surfaces (clients_gallery, showcase, testimonial)
--   social    → social media / SoMe (Instagram, Facebook, TikTok, YouTube) — manual
--   education → tutorials & training content (external) — no on-site copy
--
-- RLS mirrors the other client-owned tables: the owner (app_metadata.role) reads
-- all; a signed-in client reads THEIR OWN. Writes go through service-role server
-- actions that re-verify ownership in code (the UI is never the boundary).

create table if not exists public.media_releases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  purpose text not null check (purpose in ('website','social','education')),
  status text not null check (status in ('requested','granted','declined','withdrawn')),
  -- The wording/version the client agreed to, kept for accountability (Art. 7(1)).
  consent_version text,
  requested_at timestamptz not null default now(),
  granted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  unique (booking_id, purpose)
);

create index if not exists media_releases_client_idx
  on public.media_releases (client_id);
-- Granted-lookup: the publish gate + public gallery ask "is this booking cleared
-- for this purpose".
create index if not exists media_releases_granted_idx
  on public.media_releases (booking_id, purpose) where status = 'granted';
-- Pending-lookup: the My Space "action needed" list + request fan-out.
create index if not exists media_releases_requested_idx
  on public.media_releases (client_id) where status = 'requested';

alter table public.media_releases enable row level security;

drop policy if exists "Owner reads all media_releases" on public.media_releases;
create policy "Owner reads all media_releases" on public.media_releases
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
drop policy if exists "Clients read own media_releases" on public.media_releases;
create policy "Clients read own media_releases" on public.media_releases
  for select to authenticated using (client_id = public.current_client_id());

-- `assets` gains the link `media_consents.published_asset_id` used to hold, so
-- takedown + erasure key off the ORIGINAL, and the public copy records the purpose
-- (website/social) that authorized it. `education` never produces an on-site copy.
alter table public.assets
  add column if not exists client_media_id uuid
    references public.client_media(id) on delete cascade,
  add column if not exists purpose text check (purpose in ('website','social')),
  add column if not exists needs_takedown_at timestamptz;

create index if not exists assets_client_media_idx
  on public.assets (client_media_id);

-- Retire the per-image consent ledger. No prod data (all test) → safe drop; its
-- RLS policies drop with it.
drop table if exists public.media_consents;
