-- ============================================================================
-- Bella Nails — consolidated schema (fresh-database bootstrap)
-- ============================================================================
-- Run this ONCE on an empty Supabase project to create the full public schema:
-- tables, constraints, indexes, RLS policies, and the Realtime publication.
-- Then seed dev data with `seed.sql` (+ `addons-seed.sql`) if wanted.
--
-- ⚠️ RECONSTRUCTED, not a live dump. Sources: the generated
-- `src/lib/supabase/types.ts` (columns/nullability/FKs — itself generated from
-- the live schema) + the incremental `supabase/*.sql` migrations (checks,
-- defaults, indexes, RLS, triggers). The live project was built incrementally,
-- so treat this as the intended shape and verify against an authoritative dump
-- before trusting it for a production rebuild:
--
--   pnpm dlx supabase db dump --schema public > supabase/schema.sql
--
-- Idempotent where practical (`if not exists`); the `create policy` statements
-- error if a policy already exists — this file targets a FRESH database.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- updated_at trigger helper (empty search_path per Supabase advisor guidance).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Catalog
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  name_en        text not null,
  name_dk        text not null,
  description_en text,
  description_dk text,
  image_url      text,
  sort_order     integer,
  archived_at    timestamptz,
  created_at     timestamptz default now()
);

create table if not exists public.services (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references public.categories(id),
  name_en            text not null,
  name_dk            text not null,
  description_en     text,
  description_dk     text,
  base_price_cents   integer not null,
  base_duration_mins integer not null,
  cal_event_id       integer not null unique,
  cal_event_slug     text,
  image_url          text,
  is_featured        boolean default false,
  archived_at        timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Legacy one-to-many link kept (nullable) for rollback; reads go via service_addons.
create table if not exists public.addons (
  id                  uuid primary key default gen_random_uuid(),
  service_id          uuid references public.services(id),
  name_en             text not null,
  name_dk             text not null,
  extra_price_cents   integer not null,
  extra_duration_mins integer not null,
  archived_at         timestamptz,
  created_at          timestamptz default now()
);

-- Unordered "these two add-ons can't be combined" pairs.
create table if not exists public.addon_incompatibilities (
  addon_id_a uuid not null references public.addons(id) on delete cascade,
  addon_id_b uuid not null references public.addons(id) on delete cascade,
  primary key (addon_id_a, addon_id_b)
);

-- Many-to-many: an add-on reusable across services.
create table if not exists public.service_addons (
  service_id uuid not null references public.services(id) on delete cascade,
  addon_id   uuid not null references public.addons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, addon_id)
);
create index if not exists service_addons_addon_id_idx
  on public.service_addons (addon_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Media (public gallery assets + private per-client media/consent)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.assets (
  id                   uuid primary key default gen_random_uuid(),
  url                  text not null,
  media_type           text not null,
  storage_key          text,
  storage_provider     text not null default 'scaleway',
  cloudinary_public_id text,                       -- legacy; retained nullable
  created_at           timestamptz default now()
);

create table if not exists public.gallery_items (
  id               uuid primary key default gen_random_uuid(),
  primary_asset_id uuid references public.assets(id),
  before_asset_id  uuid references public.assets(id),
  display_mode     text not null,
  title_en         text,
  title_dk         text,
  sort_order       integer
    constraint gallery_items_sort_order_range
    check (sort_order is null or sort_order between 1 and 5),
  created_at       timestamptz default now()
);
-- At most five featured items — each homepage slot (1..5) used at most once.
create unique index if not exists gallery_items_featured_sort_order_key
  on public.gallery_items (sort_order)
  where sort_order is not null;

-- Private, per-client images (studio-owned OF a client, or client-submitted).
create table if not exists public.client_media (
  id                   uuid primary key default gen_random_uuid(),
  clerk_user_id        text not null,
  source               text not null check (source in ('owner', 'client')),
  kind                 text not null default 'image',   -- image | video
  storage_key          text,
  storage_provider     text not null default 'scaleway',
  cloudinary_public_id text,                             -- legacy; nullable
  url                  text not null,
  service_id           uuid references public.services(id),
  booking_id           uuid references public.bookings(id),
  is_feature           boolean not null default false,
  in_gallery           boolean not null default false,
  caption              text,
  created_at           timestamptz not null default now(),
  archived_at          timestamptz
);
create index if not exists client_media_clerk_user_id_idx
  on public.client_media (clerk_user_id);
create index if not exists client_media_service_id_idx
  on public.client_media (service_id);
-- Exactly one active feature image per service.
create unique index if not exists client_media_one_feature_per_service
  on public.client_media (service_id)
  where is_feature and archived_at is null and service_id is not null;

-- Per-image, per-purpose publish consent (the image consent ledger).
create table if not exists public.media_consents (
  id                 uuid primary key default gen_random_uuid(),
  client_media_id    uuid not null references public.client_media(id) on delete cascade,
  clerk_user_id      text not null,
  purpose            text not null check (purpose in ('site', 'some')),
  status             text not null default 'requested'
    check (status in ('requested', 'granted', 'declined', 'withdrawn')),
  published_asset_id uuid references public.assets(id),
  requested_at       timestamptz not null default now(),
  granted_at         timestamptz,
  declined_at        timestamptz,
  withdrawn_at       timestamptz,
  unique (client_media_id, purpose)
);
create index if not exists media_consents_clerk_user_id_idx
  on public.media_consents (clerk_user_id);

-- Using a client's data (name / words) on site or SoMe.
create table if not exists public.client_consents (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  purpose       text not null check (
    purpose in ('testimonial_site', 'testimonial_some', 'name_site', 'name_some')
  ),
  status        text not null default 'requested'
    check (status in ('requested', 'granted', 'declined', 'withdrawn')),
  requested_at  timestamptz not null default now(),
  granted_at    timestamptz,
  declined_at   timestamptz,
  withdrawn_at  timestamptz,
  unique (clerk_user_id, purpose)
);
create index if not exists client_consents_clerk_user_id_idx
  on public.client_consents (clerk_user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Bookings (rows land via the Cal.com webhook, keyed by cal_booking_id)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  cal_booking_id        bigint not null unique,
  cal_uid               text,
  rescheduled_from_uid  text,
  clerk_user_id         text not null,
  start_time            timestamptz not null,
  end_time              timestamptz not null,
  status                text not null,
  total_price_cents     integer not null,
  income_override_cents integer,
  selected_addons       jsonb,
  client_notes          text,
  reschedule_url        text not null,
  cancel_url            text not null,
  no_show_at            timestamptz,
  created_at            timestamptz default now()
);
create index if not exists bookings_cal_uid_idx on public.bookings (cal_uid);

-- Out-of-hours booking requests (artist reviews → creates the Cal booking).
create table if not exists public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  clerk_user_id     text not null,
  services          jsonb not null,
  est_duration_mins integer,
  est_price_cents   integer,
  preferred_times   jsonb,
  note              text,
  status            text not null default 'pending'
    check (status in (
      'pending', 'accepted', 'declined', 'scheduled', 'cancelled', 'expired'
    )),
  booking_id        uuid references public.bookings(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists booking_requests_clerk_user_id_idx
  on public.booking_requests (clerk_user_id);
create index if not exists booking_requests_status_idx
  on public.booking_requests (status);

drop trigger if exists set_booking_requests_updated_at on public.booking_requests;
create trigger set_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-Level Security
--   Public catalog: world-readable, active rows only. Every write is denied to
--   anon/authenticated and runs through the service-role client (webhook, admin
--   actions), which bypasses RLS. Signed-in clients read their own bookings /
--   media / consent; the owner (Clerk `metadata.role = 'owner'`) reads all.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.categories              enable row level security;
alter table public.services                enable row level security;
alter table public.addons                  enable row level security;
alter table public.addon_incompatibilities enable row level security;
alter table public.service_addons          enable row level security;
alter table public.assets                  enable row level security;
alter table public.gallery_items           enable row level security;
alter table public.bookings                enable row level security;
alter table public.booking_requests        enable row level security;
alter table public.client_media            enable row level security;
alter table public.media_consents          enable row level security;
alter table public.client_consents         enable row level security;

-- Public catalog reads (active rows only where an archived flag exists).
create policy "Public reads active categories"
  on public.categories for select to anon, authenticated using (archived_at is null);
create policy "Public reads active services"
  on public.services for select to anon, authenticated using (archived_at is null);
create policy "Public reads active addons"
  on public.addons for select to anon, authenticated using (archived_at is null);
create policy "Public reads addon incompatibilities"
  on public.addon_incompatibilities for select to anon, authenticated using (true);
create policy "Public reads service addons"
  on public.service_addons for select to anon, authenticated using (true);
create policy "Public reads assets"
  on public.assets for select to anon, authenticated using (true);
create policy "Public reads gallery items"
  on public.gallery_items for select to anon, authenticated using (true);

-- Bookings: client reads own, owner reads all.
create policy "Users read own bookings"
  on public.bookings for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owner reads all bookings"
  on public.bookings for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');

-- Booking requests: client reads/creates own (pending only); admin via service-role.
create policy "Users read own booking requests"
  on public.booking_requests for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Users create own pending booking requests"
  on public.booking_requests for insert to authenticated
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and status = 'pending'
    and booking_id is null
  );

-- Client media + consent: owner reads all, client reads own; writes service-role.
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

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — the admin queues update live.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'booking_requests'
  ) then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;
