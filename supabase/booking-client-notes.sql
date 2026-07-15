-- Client session notes (July 2026).
-- The note from the booking form previously lived only inside Cal's
-- free-text notes (emails/calendar). It now also arrives as machine
-- metadata (clientNotes) and is stored so /bookings can show it.
--
-- Run BEFORE deploying the webhook change that writes this column.

alter table public.bookings
  add column if not exists client_notes text;

comment on column public.bookings.client_notes is
  'The client''s own session note from the booking form (webhook metadata clientNotes). Also embedded in the human notes string Cal shows the artist.';
