-- Asset hub v2: favourites + auto-place-on-grant.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

-- Favourites: the artist can heart any client photo at any point in its life,
-- independent of consent state (a curation shortlist).
alter table public.client_media
  add column if not exists favorited_at timestamptz;

-- Auto-place-on-grant: when the artist "publishes to gallery" a not-yet-consented
-- photo, the site consent request carries this flag; on grant the published copy
-- is auto-placed on the clients_gallery surface — no separate manual placement.
alter table public.media_consents
  add column if not exists auto_place boolean not null default false;
