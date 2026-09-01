-- The ONE authority for `communications.kind`.
--
-- Every feature that sends a new client-facing message widens this check. It
-- used to be restated inline in each feature's migration, which meant re-running
-- an older file silently NARROWED the set again — and because
-- `recordCommunication` is best-effort, a rejected kind fails silently and the
-- send just never appears in the client's history.
--
-- Adding a kind: append it here AND to `CommunicationKind` in
-- src/modules/notifications/communications.ts. Safe to re-run.
alter table public.communications drop constraint if exists communications_kind_check;
alter table public.communications add constraint communications_kind_check
  check (kind in (
    'confirmation','cancellation','reschedule','reminder',
    'media_release_request','review_request',
    'booking_request_received','booking_request_declined',
    'design_request_received','design_reply','design_offer_sent',
    'design_request_declined',
    'testimonial_request'
  ));
