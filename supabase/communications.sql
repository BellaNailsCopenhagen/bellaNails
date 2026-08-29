-- Communication log: one row per transactional message (email today, push later)
-- plus its trigger, giving the studio a per-client audit trail and making the
-- manual reminder run idempotent per booking. Service-role writes; RLS is ON with
-- NO policies (service-role bypasses; anon/authenticated denied — rows hold the
-- recipient email = PII). On GDPR erasure the recipient (the only PII) is scrubbed
-- and the metadata log is KEPT, like the anonymized bookings it trails
-- (see modules/clients/anonymize).

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  -- WHAT the message is. Scope: outbound messages TO A CLIENT. The set grows with
  -- new client-facing sends (e.g. photo-consent / video-approval requests). Alerts
  -- TO THE STUDIO (a client withdrawing consent, a new booking) are a different
  -- audience and live in owner_notifications, NOT here.
  kind text not null check (kind in ('confirmation','cancellation','reschedule','reminder','media_release_request','review_request','booking_request_received','booking_request_declined')),
  trigger text not null check (trigger in ('auto','manual')),
  -- HOW it was delivered — one row per (message, channel) so each delivery keeps
  -- its own status. email today; in_app / push arrive with the client PWA.
  channel text not null default 'email' check (channel in ('email','in_app','push')),
  recipient text,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  -- The appointment start a reminder was for (reminders only). Idempotency keys
  -- on (booking_id, reminder_for), so a reschedule to a new time re-reminds
  -- instead of being suppressed by the old booking_id's reminder.
  reminder_for timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists communications_client_created_idx
  on public.communications (client_id, created_at desc);
-- Reminder idempotency, enforced by the DB: at most ONE successful reminder per
-- (booking, appointment time). Failed/skipped attempts stay unconstrained so a
-- retry can still land. This is the backstop under the app-level check — it also
-- serves the "which of these already got a sent reminder" lookup (booking_id leads).
create unique index if not exists communications_reminder_sent_idx
  on public.communications (booking_id, reminder_for)
  where kind = 'reminder' and status = 'sent';

-- Widen the kind check on an already-created table (adds the Feature B request
-- kinds). Safe to re-run.
alter table public.communications drop constraint if exists communications_kind_check;
alter table public.communications add constraint communications_kind_check
  check (kind in ('confirmation','cancellation','reschedule','reminder','media_release_request','review_request','booking_request_received','booking_request_declined'));

alter table public.communications enable row level security;
-- No policies on purpose — service-role bypasses RLS; everyone else is denied.
