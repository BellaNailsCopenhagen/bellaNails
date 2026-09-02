-- Who has read what on a design thread.
--
-- `client_seen_at` is the client's read-marker: without it My Space cannot tell
-- "the studio replied" from "the studio replied three weeks ago", so the banner
-- would either never appear or never leave. Only the client's side is tracked —
-- the artist's unread state already lives in owner_notifications.
--
-- `last_artist_reply_at` is denormalised on purpose. It is derivable from
-- design_messages, but the unread check is a two-column comparison the home
-- banner has to make on every page load; as a column it is one indexed read of
-- one table. Written wherever the studio answers (modules/design/*-actions.ts).
-- APPLY via the Supabase SQL editor, then regenerate src/platform/supabase/types.ts.

alter table public.design_requests
  add column if not exists client_seen_at timestamptz,
  add column if not exists last_artist_reply_at timestamptz;
