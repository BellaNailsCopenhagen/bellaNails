-- Owner notifications — the studio's in-app alert feed. First use: a client
-- withdrawing image-publish consent (the site copy auto-unpublishes, but a
-- SOCIAL post must be taken down by hand — so the artist must be told).
-- APPLY via the Supabase SQL editor / MCP, then regenerate src/lib/supabase/types.ts.

create table if not exists public.owner_notifications (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,                 -- 'media_consent_withdrawn'
  clerk_user_id   text not null,                 -- the client the event is about
  client_media_id uuid references public.client_media(id) on delete set null,
  purpose         text,                          -- 'site' | 'some' (media consent)
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists owner_notifications_unread_idx
  on public.owner_notifications (created_at desc) where read_at is null;

-- Owner reads all; every write is service-role (bypasses RLS).
alter table public.owner_notifications enable row level security;
create policy "Owner reads all notifications"
  on public.owner_notifications for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
