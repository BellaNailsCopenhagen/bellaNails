# Booking flows — surface map

Each admin surface answers one question, using one module read. The reads differ
in **time window** and **status filter** so no two surfaces show contradictory
data for the same appointment.

## The three admin surfaces

| Surface | Route | Reads | Time window | Status filter | Shape |
|---------|-------|-------|-------------|---------------|-------|
| **Command centre** | `/admin` | `getAdminFocus(now)` | Now: in-progress + next | Active only | `current` + `next` cards |
| **Agenda / Queue** | `/admin/agenda` | `getAdminQueue(now)` | Future only (`end_time >= now`) | Active only | Weeks → days, grouped |
| **Appointments browse** | `/admin/appointments` | `getAdminAppointments(now, pastLimit)` | Upcoming + recent past | Any (incl. cancelled) | Flat list, client groups/filter |

## The reads (in `src/modules/booking/reads.ts`)

### `getAdminFocus(now)`
Returns the booking **in progress** (`start ≤ now < end`) and the **soonest upcoming** (`start > now`). Used by the command centre home. Two targeted reads (`getCurrentBooking`, `getNextBooking`), degrades to nulls.

### `getAdminQueue(now)`
The forward agenda. Uses `listActiveBookingsFrom(now)` — active statuses only, not yet finished (`end_time >= now`). Grouped by week → day via `groupIntoAgenda`. Empty weeks within 8 weeks are shown so calendar gaps are visible. **Future only.**

### `getAdminAppointments(now, pastLimit)`
The full browse. Uses `listBookingsFrom(now)` (any status, not yet finished) + `listBookingsBefore(now, pastLimit)` (finished, capped window). Flat list; the client (`AdminBookings`) handles weekly/monthly grouping, status filter, and collapse. **Upcoming + recent past.**

## Why the queue filters by active statuses but appointments doesn't

The agenda is for **managing the week ahead** — cancelled or no-show bookings are noise there, so `listActiveBookingsFrom` restricts to `ACTIVE_BOOKING_STATUSES`.

The appointments browse is for **looking up specific appointments** — a cancelled booking still matters (refund follow-up, rebook conversation), so `listBookingsFrom` returns any status.

## The db reads (in `src/db/bookings.ts`)

| Function | SQL intent | Used by |
|----------|-----------|---------|
| `listActiveBookingsFrom(now)` | `status IN active AND end_time >= now` | `getAdminQueue` |
| `listBookingsFrom(now)` | `end_time >= now` (any status) | `getAdminAppointments` |
| `listBookingsBefore(now, limit)` | `end_time < now`, capped, newest first | `getAdminAppointments` |
| `getCurrentBooking(now)` | `start ≤ now < end`, active | `getAdminFocus` |
| `getNextBooking(now)` | `start > now`, active | `getAdminFocus` |

## Client booking surfaces

| Surface | Route | Reads | Auth |
|---------|-------|-------|------|
| My bookings | `/[locale]/bookings` | `getMyBookings(clientId, locale)` | Session-scoped (own rows only) |
| Manage (signed link) | `/[locale]/manage/[token]` | `getBookingForSignedToken(id)` | Token-verified, service-role |
| Manage (owner) | `/admin/bookings/[id]` | `getBookingForManageAsOwner(id)` | Owner-gated |

---

## Media / image-publishing flow

The release lifecycle governs when a client's photos/videos may be published.
Consent is the ceiling; the artist picks which shots to actually publish.

### States (per booking × purpose)

`none → requested → granted → withdrawn` (or `declined` as a terminal refusal)

- `none` — never asked (no row)
- `requested` — studio has asked, client hasn't decided
- `granted` — client consented; artist may publish
- `declined` — client refused; terminal (never auto-resurrected)
- `withdrawn` — client had granted, then revoked; unpublishes existing copies

### The publish path (artist side)

1. **Client grants release** — `requestMediaRelease` / `respondToReleaseToken` /
   `decideMediaRelease` writes a `media_releases` row with `status = 'granted'`.
2. **Artist publishes** — `placeMedia` / `bulkAddToGallery` calls `publishOne`
   which checks `isBookingReleased(booking_id, purpose)` (consent gate), copies
   the private original to the public bucket, creates an `assets` row, then
   places it on a surface via `asset_usages`.
3. **Placement** — `setPlacementLink` ties the asset to a surface (website /
   social / gallery). One public copy per (original, purpose) — idempotent.

### The withdraw path (client side)

1. **Client withdraws** — `withdrawMediaRelease` sets `status = 'withdrawn'`,
   `withdrawn_at = now`.
2. **Unpublish** — `unpublishBookingMedia`:
   - `social` — flags assets for manual takedown (external posts can't be auto-removed)
   - `website` — deletes the public file first, then the asset row (file first
     so a withdrawn photo is never left world-readable with no retry path)
   - `education` — no on-site copy, nothing to unpublish
3. **Confirm takedown** — `confirmTakedown` (asset-level): deletes the kept
   public copy, gallery items, and the asset row. Used when the artist confirms
   a social post is actually gone.

### GDPR erasure

`purgeMediaArtifacts` — full destruction of storage artifacts for a client.
Called only after authorization; the most destructive path.
