-- Task 11 — client media + consent (GDPR). See docs/tasks/admin/11-gallery-consent.md.
-- APPLY via the Supabase MCP, then regenerate src/lib/supabase/types.ts
-- (the hand-added types in that file mirror this migration — keep them in sync).
--
-- Model: private client images live in `client_media` (owner + the client read
-- them; nobody else). Publishing is copy-on-consent — a granted `media_consents`
-- row copies the image to the PUBLIC `assets` table; withdrawal deletes it.

-- Published copies keep their Cloudinary id so withdrawal can delete them.
alter table public.assets
  add column if not exists cloudinary_public_id text;

-- 1. Private, per-client images (studio-owned OF a client, or client-submitted).
create table if not exists public.client_media (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  source text not null check (source in ('owner', 'client')),
  cloudinary_public_id text not null,
  url text not null,
  service_id uuid references public.services(id),
  booking_id uuid references public.bookings(id),
  is_feature boolean not null default false,
  in_gallery boolean not null default false,
  caption text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists client_media_clerk_user_id_idx
  on public.client_media (clerk_user_id);
create index if not exists client_media_service_id_idx
  on public.client_media (service_id);
-- Exactly one feature image per service (the product image).
create unique index if not exists client_media_one_feature_per_service
  on public.client_media (service_id)
  where is_feature and archived_at is null and service_id is not null;

-- 2. Per-image, per-purpose publish consent (the image consent ledger).
create table if not exists public.media_consents (
  id uuid primary key default gen_random_uuid(),
  client_media_id uuid not null references public.client_media(id) on delete cascade,
  clerk_user_id text not null,
  purpose text not null check (purpose in ('site', 'some')),
  status text not null default 'requested'
    check (status in ('requested', 'granted', 'declined', 'withdrawn')),
  published_asset_id uuid references public.assets(id),
  requested_at timestamptz not null default now(),
  granted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  unique (client_media_id, purpose)
);
create index if not exists media_consents_clerk_user_id_idx
  on public.media_consents (clerk_user_id);

-- 3. Using a client's data (name / words) on site or SoMe.
create table if not exists public.client_consents (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  purpose text not null check (
    purpose in ('testimonial_site', 'testimonial_some', 'name_site', 'name_some')
  ),
  status text not null default 'requested'
    check (status in ('requested', 'granted', 'declined', 'withdrawn')),
  requested_at timestamptz not null default now(),
  granted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  unique (clerk_user_id, purpose)
);
create index if not exists client_consents_clerk_user_id_idx
  on public.client_consents (clerk_user_id);

-- 4. RLS: owner-reads-all + client-reads-own; every write is service-role.
alter table public.client_media    enable row level security;
alter table public.media_consents  enable row level security;
alter table public.client_consents enable row level security;

create policy "Owner reads all client_media"
  on public.client_media for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
create policy "Clients read own client_media"
  on public.client_media for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owner reads all media_consents"
  on public.media_consents for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
create policy "Clients read own media_consents"
  on public.media_consents for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owner reads all client_consents"
  on public.client_consents for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
create policy "Clients read own client_consents"
  on public.client_consents for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
