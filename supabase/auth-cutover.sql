-- ============================================================================
-- AUTH CUTOVER: Clerk → Supabase Auth.  ⚠️ DESTRUCTIVE — DO NOT APPLY YET. ⚠️
-- ----------------------------------------------------------------------------
-- Re-keys identity from `clerk_user_id` (text) to `client_id` (uuid → clients),
-- wipes all client-identity data + published media, and rewrites RLS from Clerk
-- claims to Supabase Auth (`current_client_id()` + `app_metadata.role`).
--
-- APPLY ONLY at cutover, together with the code swap (factories + proxy →
-- @supabase/ssr, facade innards, types.ts, .eq("clerk_user_id") → client_id),
-- AND after: Google + email-OTP are enabled in Supabase Auth, and the owner's
-- app_metadata.role is set (see the end of this file). Run in one transaction.
--
-- Wipe scope (your call): client-identity data AND published media. Studio
-- catalog (services, add-ons, service_sections) is KEPT — but note service
-- section images point at `assets` via ON DELETE SET NULL, so wiping assets sets
-- those image links to null (the sections survive; re-upload their images).
-- This is why the wipe uses ordered DELETE, NOT `truncate ... cascade` (which
-- would ignore SET NULL and truncate service_sections too).
-- ============================================================================

begin;

-- 1. clients (identity) ------------------------------------------------------
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,          -- always lowercased; the join key
  name         text,
  phone        text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

GRANT SELECT ON TABLE public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;

alter table public.clients enable row level security;

drop policy if exists "Owner reads all clients" on public.clients;
create policy "Owner reads all clients" on public.clients
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

drop policy if exists "Clients read own row" on public.clients;
create policy "Clients read own row" on public.clients
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- Link (or create) a clients row when someone logs in, joined by EMAIL — this
-- is how a returning guest booker keeps their history. Runs as the auth insert.
create or replace function public.link_client_on_auth_user()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Google + email-OTP always carry an email; guard anyway (email is NOT NULL).
  if new.email is not null then
    insert into public.clients (email, auth_user_id)
    values (lower(new.email), new.id)
    on conflict (email) do update
      set auth_user_id = excluded.auth_user_id, updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_client_on_auth_user();

-- The current user's client id (null when signed out / not yet a client).
create or replace function public.current_client_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select id from public.clients where auth_user_id = auth.uid()
$$;

-- 2. Drop old identity RLS (they reference clerk_user_id / metadata.role) -----
drop policy if exists "Users read own bookings" on public.bookings;
drop policy if exists "Owner reads all bookings" on public.bookings;
drop policy if exists "Users read own booking requests" on public.booking_requests;
drop policy if exists "Users create own pending booking requests" on public.booking_requests;
drop policy if exists "Owner reads all client_media" on public.client_media;
drop policy if exists "Clients read own client_media" on public.client_media;
drop policy if exists "Owner reads all media_consents" on public.media_consents;
drop policy if exists "Clients read own media_consents" on public.media_consents;
drop policy if exists "Owner reads all client_consents" on public.client_consents;
drop policy if exists "Clients read own client_consents" on public.client_consents;
drop policy if exists "Owner reads all terms_acceptances" on public.terms_acceptances;
drop policy if exists "Clients read own terms_acceptances" on public.terms_acceptances;
drop policy if exists "Owner reads all notifications" on public.owner_notifications;
drop policy if exists "Owner reads price history" on public.price_history;

-- 3. WIPE (ordered DELETE — children before parents; SET NULL keeps sections) -
delete from public.terms_acceptances;
delete from public.asset_usages;
delete from public.gallery_items;
delete from public.media_consents;
delete from public.client_consents;
delete from public.client_media;
delete from public.booking_requests;
delete from public.owner_notifications;
delete from public.bookings;
delete from public.assets;   -- service_sections.asset_id → null (sections kept)

-- 4. Re-key: clerk_user_id (text) → client_id (uuid). Tables now empty, so no
--    backfill — drop the text column + add the fk column & keys. Dropping the
--    column also drops its indexes and the unique constraints that included it.
alter table public.bookings drop column clerk_user_id;
alter table public.bookings add column client_id uuid not null
  references public.clients(id) on delete cascade;
create index bookings_client_id_idx on public.bookings (client_id);

alter table public.booking_requests drop column clerk_user_id;
alter table public.booking_requests add column client_id uuid not null
  references public.clients(id) on delete cascade;
create index booking_requests_client_id_idx on public.booking_requests (client_id);

alter table public.client_media drop column clerk_user_id;
alter table public.client_media add column client_id uuid not null
  references public.clients(id) on delete cascade;
create index client_media_client_id_idx on public.client_media (client_id);

alter table public.media_consents drop column clerk_user_id;
alter table public.media_consents add column client_id uuid not null
  references public.clients(id) on delete cascade;
create index media_consents_client_id_idx on public.media_consents (client_id);

alter table public.client_consents drop column clerk_user_id;
alter table public.client_consents add column client_id uuid not null
  references public.clients(id) on delete cascade;
alter table public.client_consents add unique (client_id, purpose);
create index client_consents_client_id_idx on public.client_consents (client_id);

alter table public.terms_acceptances drop column clerk_user_id;
alter table public.terms_acceptances add column client_id uuid not null
  references public.clients(id) on delete cascade;
alter table public.terms_acceptances add unique (client_id, kind, reference_id);
create index terms_acceptances_client_id_idx on public.terms_acceptances (client_id);

alter table public.owner_notifications drop column clerk_user_id;
alter table public.owner_notifications add column client_id uuid not null
  references public.clients(id) on delete cascade;
create index owner_notifications_client_id_idx on public.owner_notifications (client_id);

-- 5. New RLS: client-own = current_client_id(); owner = app_metadata.role -----
create policy "Users read own bookings" on public.bookings
  for select to authenticated using (client_id = public.current_client_id());
create policy "Owner reads all bookings" on public.bookings
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

create policy "Users read own booking requests" on public.booking_requests
  for select to authenticated using (client_id = public.current_client_id());
create policy "Users create own pending booking requests" on public.booking_requests
  for insert to authenticated
  with check (client_id = public.current_client_id()
              and status = 'pending' and booking_id is null);

create policy "Owner reads all client_media" on public.client_media
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy "Clients read own client_media" on public.client_media
  for select to authenticated using (client_id = public.current_client_id());

create policy "Owner reads all media_consents" on public.media_consents
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy "Clients read own media_consents" on public.media_consents
  for select to authenticated using (client_id = public.current_client_id());

create policy "Owner reads all client_consents" on public.client_consents
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy "Clients read own client_consents" on public.client_consents
  for select to authenticated using (client_id = public.current_client_id());

create policy "Owner reads all terms_acceptances" on public.terms_acceptances
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy "Clients read own terms_acceptances" on public.terms_acceptances
  for select to authenticated using (client_id = public.current_client_id());

create policy "Owner reads all notifications" on public.owner_notifications
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owner reads price history" on public.price_history
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

commit;

-- ============================================================================
-- AFTER APPLYING (owner, once):
--   -- make yourself the owner (role lives in app_metadata, not user-editable):
--   update auth.users
--     set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}'::jsonb
--     where email = '<owner-email>';
-- PRE-REQ: Supabase Auth → enable Google (needs the OAuth client) + Email OTP,
--   set custom SMTP → ZeptoMail, edit the OTP template to emit {{ .Token }},
--   and add the redirect URL <site>/api/auth/callback to the allow-list.
-- REVIEW BEFORE APPLYING: confirm the dropped policy NAMES match live (names
--   here are from the migration files); this session had no live DB access.
-- ============================================================================
