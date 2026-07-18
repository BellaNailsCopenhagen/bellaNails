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

## Design source (use this — July 2026)

The admin design exists as a Claude Design project and is the **strong
design direction** for every task in this folder:

- **Rendered reference (look here first):** the exported HTML is saved in-repo
  at [`../../design/Bella Nails Admin.html`](../../design/Bella%20Nails%20Admin.html)
  — open it in a browser to see the full admin design.
- Source project (to re-import/edit) via the `claude_design` MCP server
  (`https://api.anthropic.com/v1/design/mcp`, authenticate with
  `/design-login`): https://claude.ai/design/p/c3b840d8-04b7-4adb-8c48-abb7b51f9c67?file=Bella+Nails+Admin.dc.html
- Implement: **`Bella Nails Admin.dc.html`** (rendered as the in-repo file above).
- "Strong direction" means: follow its layout, hierarchy, and component
  usage — small refinements and additions are expected as we test, but
  deviations should be deliberate, not improvised. Where the design file
  and the codebase's existing components conflict, reuse the existing
  component and match the design's intent (the reuse map below wins on
  implementation, the design wins on look).
- The written spec behind it: [`../../design/admin-design-brief.md`](../../design/admin-design-brief.md)
  — still authoritative for states/flows the design file doesn't cover.

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
                 │                    └─▶ 06 studio bookings ─▶ 07 clients ─▶ 08 photo consent ─▶ 09 client voice
                 └─▶ 03 services CRUD + Cal sync
                 └─▶ 04 gallery + testimonials ──────────────────────────▶ 08, 09
```

01 blocks everything. 02–04 are independent after it. 05 needs 02's queue to
link into. 06 surfaces in 02's queue. 07 (client directory) wants 02 (queue
cards link to client pages) and 06 (its "New booking" prefill target); its
media upload reuses 04's Cloudinary plumbing. 08 (publication consent) needs
07's client media and 04's gallery, and adds a client-facing card on
`/bookings`. 09 (client testimonials + "my photos" transparency) builds on
04's testimonials table and 08's consent/withdraw — mostly client-facing on
`/bookings`. ⚠️ 04 and 09 must agree on ONE testimonials status model
(`pending|published|declined`, not a bare boolean) — see both briefs.

## Prerequisites (owner, before Task 01 merges)

- [ ] Set `publicMetadata.role = "owner"` on the artist's Clerk user (and the
      owner's own account) in the Clerk dashboard.
- [ ] Regenerate `src/lib/supabase/types.ts` from the live schema.
- [ ] Apply [supabase/gallery-ordering.sql](../../../supabase/gallery-ordering.sql) (Task 04 depends on it).
- [ ] Task 06 ships `supabase/booking-origin.sql` (origin + client_accepted_at) — migration before its deploy, as always.
- [ ] Task 07 ships `supabase/clients.sql` (`client_notes` + `client_media`, owner-only RLS) — same rule; needs a privacy-policy paragraph from the owner (client records: notes + reference photos, retention, erasure).
- [ ] Task 08 ships `supabase/photo-consent.sql` (`consent_terms` + `media_publication_consents`) — needs the owner-written consent terms text (da+en) as the v1 seed.
- [ ] Task 09 ships `supabase/testimonial-submissions.sql` (submission columns + `testimonial_requests`) and the deliberate client-select-own RLS on `client_media`.
