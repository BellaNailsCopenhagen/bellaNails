-- Supabase environment shim — for running schema.sql on BARE Postgres.
--
-- A real Supabase project already provides all of this. You need it only to
-- verify the schema locally, e.g.
--
--   docker run -d --name bn-db -e POSTGRES_PASSWORD=x -e POSTGRES_DB=bn \
--     -p 55432:5432 postgres:15.3-alpine3.18
--   psql "postgres://postgres:x@localhost:55432/bn" -f supabase/local-postgres-shim.sql
--   psql "postgres://postgres:x@localhost:55432/bn" -f supabase/schema.sql
--
-- It is NOT a substitute for Supabase Auth: `auth.users` here is a stub with
-- the three columns our trigger and policies touch, and nothing writes to it.
-- Reproduces the parts of a Supabase project the migrations reference:
-- the three API roles, the auth schema + auth.uid()/auth.jwt(), the storage
-- schema, and the realtime publication.
-- ---------------------------------------------------------------------------
-- REFUSE TO RUN ON A REAL SUPABASE PROJECT.
-- Below this line we `create or replace` auth.uid() and friends. On a real
-- project that would overwrite Supabase's own auth functions, which is a very
-- bad afternoon. If auth.users already exists, this is not a bare Postgres.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
  ) then
    raise exception
      'auth.users already exists — this looks like a real Supabase project. %',
      'The shim is for bare Postgres only; run schema.sql on its own instead.';
  end if;
end $$;

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create or replace function auth.email() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.email', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid,
  metadata jsonb, created_at timestamptz default now()
);
grant usage on schema storage to anon, authenticated, service_role;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
