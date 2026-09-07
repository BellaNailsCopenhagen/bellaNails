-- Add the missing `alert_email` column to `business_profile`.
--
-- The column has been in business-profile.sql since that file was written, but
-- the live table does not have it — so whatever ran against the database was not
-- this file. Re-running it does NOT help: it opens with
-- `create table if not exists`, which does nothing to a table that already
-- exists, and adds no columns to it.
--
-- The symptom is not "the alert address won't save". `saveBusinessProfile` sends
-- every field on every save, so ONE missing column fails the whole form:
-- changing the address or a social link returns "Couldn't save that." too.
--
-- Checked 7 Sep 2026: this is the only column in the app's types that the live
-- database is missing, across all 35 tables.
--
-- APPLY via the Supabase SQL editor.

alter table public.business_profile
  add column if not exists alert_email text;

comment on column public.business_profile.alert_email is
  'Where the app writes TO her. A To: is never validated by a mail provider, so '
  'this is the one address that can be personal. Empty falls back to contact_email.';
