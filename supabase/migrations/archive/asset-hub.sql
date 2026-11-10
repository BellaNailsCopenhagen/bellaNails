-- Asset management hub support.
-- APPLY via the Supabase SQL editor / MCP, then regenerate types.ts.

-- Withdraw-in-use retention: when a client withdraws an asset that's live on a
-- MANUAL surface (social), we can't remove the post for them — so the published
-- copy is kept and flagged, landing in the hub's "Used & withdrawn" tab until
-- the artist confirms the takedown (then it's erased). Site surfaces auto-clear.
alter table public.media_consents
  add column if not exists needs_takedown_at timestamptz;

-- "Dismissed": the artist saw a client upload and chose not to act on it (not a
-- deletion — the client's photo stays theirs). Keeps the New tab to real
-- pending work.
alter table public.client_media
  add column if not exists dismissed_at timestamptz;
