# Admin — Shared Context (read first)

> Every task in this folder assumes you've read this file AND
> [`../booking-completion/00-context.md`](../booking-completion/00-context.md)
> — all conventions there (Next 16 quirks, `_dk` columns, cents, soft-delete,
> i18n parity, thin pages, house rules) apply unchanged.

## What this group delivers

The owner surface at `/[locale]/admin`: a **mobile-first PWA** the artist
lives in on her phone — live booking queue with push notifications, services
& add-on management with Cal event-type sync, gallery/testimonials curation.

**Decided (owner, July 2026):** phone-first via installable PWA + web push.
NOT Electron (desktop-only) and NOT a native/store app for now — a Capacitor
wrapper can be added later on the same code if ever wanted. Interim alerting
(before push ships): "new booking" email from the webhook via Zoho.

## Design constraints

- **Mobile-first**: the artist manages bookings between clients, on a phone.
  Card lists over dense tables; thumb-sized targets; the desktop layout is
  the enhancement, not the baseline.
- Same design system as the client site (typography, `TintedCard`,
  `BookingStatusBadge`, `EmptyState`, `Skeleton`, `AlertDialog`). The admin
  looks like Bella Nails, not like a generic dashboard.
- `noindex` everything under `/admin`.

## Auth model

- Owner identity = the Clerk user with `publicMetadata.role === "owner"`
  (set once in the Clerk dashboard). The proxy's `/admin` matcher upgrades
  from "signed in" to "signed in AND owner" (Task 01).
- DB reads: a new **owner-reads-all** RLS policy on `bookings` keyed off the
  Clerk role claim in the JWT — so admin pages use the same authed client
  pattern as `/bookings`, no service-role in render paths (house rule).
- Mutations (Cal API calls, catalog writes): server actions that re-verify
  the owner role — the UI is never the boundary.

## Reuse map (build on, never rebuild)

| Need | Use |
|---|---|
| Booking persist (create/reschedule) | `persistCalBooking` / `syncBookingFromCal` (`src/lib/booking-sync.ts`) |
| Cal API v2 | `CALCOM_API_BASE` + `CALCOM_API_KEY` (see `cancel-booking.ts` for the call shape; `cal-api-version` headers: bookings `2024-08-13`, event types `2024-06-14`) |
| Booking display shapes | `src/lib/booking-display.ts` (`BOOKING_DISPLAY_COLUMNS`, `toDisplayBooking`, `fetchBookingCatalog`, `canManageBooking`) |
| Status chip | `BookingStatusBadge` (size it up via `size` prop for the queue) |
| Statuses | `BOOKING_STATUS` / `ACTIVE_BOOKING_STATUSES` — new statuses (`requested`, `declined`) land WITH the request flow, extending these |
| Dates/times | `src/lib/studio-time.ts` (always studio TZ) |
| Slot-length math | `computeBookingTotals` (`booking-totals.ts`) — Task 03 derives `lengthInMinutesOptions` from it |
| Client identity | Clerk Backend API via `clerkClient()` (see `ensure-user.ts`) — the owner MAY see client name/email/phone (fetched from Clerk per booking, never stored in our DB) |

## Task order

```
01 shell+auth+PWA ─▶ 02 queue+realtime ─▶ 05 push notifications
                 │                    └─▶ 06 studio bookings ─▶ 07 clients ─▶ 08 photo consent
                 └─▶ 03 services CRUD + Cal sync
                 └─▶ 04 gallery + testimonials ──────────────────────────▶ 08
```

01 blocks everything. 02–04 are independent after it. 05 needs 02's queue to
link into. 06 surfaces in 02's queue. 07 (client directory) wants 02 (queue
cards link to client pages) and 06 (its "New booking" prefill target); its
media upload reuses 04's Cloudinary plumbing. 08 (publication consent) needs
07's client media and 04's gallery, and adds a client-facing card on
`/bookings`.

## Prerequisites (owner, before Task 01 merges)

- [ ] Set `publicMetadata.role = "owner"` on the artist's Clerk user (and the
      owner's own account) in the Clerk dashboard.
- [ ] Regenerate `src/lib/supabase/types.ts` from the live schema.
- [ ] Apply [supabase/gallery-ordering.sql](../../../supabase/gallery-ordering.sql) (Task 04 depends on it).
- [ ] Task 06 ships `supabase/booking-origin.sql` (origin + client_accepted_at) — migration before its deploy, as always.
- [ ] Task 07 ships `supabase/clients.sql` (`client_notes` + `client_media`, owner-only RLS) — same rule; needs a privacy-policy paragraph from the owner (client records: notes + reference photos, retention, erasure).
- [ ] Task 08 ships `supabase/photo-consent.sql` (`consent_terms` + `media_publication_consents`) — needs the owner-written consent terms text (da+en) as the v1 seed.
