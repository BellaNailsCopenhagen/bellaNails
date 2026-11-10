# Task 05 — Push notifications (new bookings)

> Read [`00-context.md`](./00-context.md) first. Depends on Tasks 01 + 02.

## Goal

The artist's phone buzzes when a booking is created, rescheduled, or
cancelled — the reason the admin is a PWA.

## In scope

- **Web push, no new vendors**: VAPID keys (env), a `push_subscriptions`
  table (endpoint, keys, `clerk_user_id`, created_at; owner-only RLS),
  service worker handling `push` + `notificationclick` (deep-link into the
  queue), an "enable notifications" toggle in the admin shell.
- **Trigger from the write path**: after `persistCalBooking` /
  `markCancelled` succeed in the webhook (and sync, deduped — don't notify
  twice for the same transition; the duplicate short-circuit already knows),
  send to all owner subscriptions via `web-push`. Payload: event type,
  client first name, service, studio-local time.
- iOS reality check in the brief: push requires the PWA installed to the
  home screen (iOS 16.4+) — document that in the enable-notifications UI.
- **Interim fallback shipped first if this task lags**: "new booking" email
  to `STUDIO_EMAIL` from the same trigger point via Zoho SMTP — one function,
  removable when push lands (or kept as belt-and-braces).

## Out of scope

- Client-facing notifications (they get Cal emails; branded emails are their
  own phase).
- Notification preferences beyond on/off.

## Acceptance criteria

- Booking made on the client site → notification on the installed PWA within
  seconds → tap opens the queue at that booking.
- A sync-then-webhook double write produces ONE notification.
- Unsubscribed/expired endpoints are pruned on send failure.
