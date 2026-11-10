-- Client anonymization (GDPR erasure = anonymize, not hard-delete).
-- `anonymized_at` marks a client whose PII has been scrubbed; the row + its
-- bookings/consents/links are retained (financial record + proof). Set by the
-- anonymizeClient server action. APPLY via the Supabase SQL editor.
alter table public.clients
  add column if not exists anonymized_at timestamptz;
