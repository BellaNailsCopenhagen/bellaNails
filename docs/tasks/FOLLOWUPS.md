# Follow-ups — noted, fix later

Small fixes/enhancements captured mid-work. Not blocking; pick up when convenient.

### Design requests — deferred after the first build

- **Rate limiting is per-process** *(partly addressed)*. A durable limiter now
  exists — `db/rate-limits.ts` + `supabase/rate-limits.sql`, counting inside
  Postgres — and the two booking writes use it. `shared/rate-limit.ts` is still
  what guards `/api/media/sign` (20 uploads/hour), design messages and the
  housekeeping throttle, and those are still per-instance. Move them over if any
  of them is ever actually abused; the pure function is fine for the throttle.
- **Housekeeping has no scheduler.** `runDesignHousekeeping` is throttled to once
  an hour and triggered by someone opening `/admin`. If nobody does,
  offers don't expire and reference photos aren't purged. One cron trigger fixes
  it — see [SCHEDULER-OPTIONS.md](in-house/SCHEDULER-OPTIONS.md).
- **The orphan sweep scans at most 1000 objects** per run (10 pages of 100). Fine
  at the studio's volume; revisit if `media-refs` ever grows past that.
- **The booking-request picker still sizes slots from the LIVE service**, while
  `acceptBookingRequest` uses the request's snapshot duration. Pre-existing, and
  now inconsistent with the reschedule paths, which were moved onto
  `bookedDurationMins`. Give the request card a `getOwnerSlotsForRequest` that
  reads the snapshot, the way `getOwnerOfferSlots` reads the offer.
- **`design_requests` has no admin list page.** The queue on `/admin` only shows
  `open` + `offered`; closed and booked ones are reachable only through the
  client's page. Fine for now — add a filtered list if the studio wants history.

### Booking-request copy → move into the next-intl catalog
The client booking-request UI (`booking-request-form.tsx` + the "Can't find a
time?" ghost button in `booking-slot-step.tsx`) uses a hand-rolled bilingual COPY
map / inline `locale === "en"` ternary instead of `t()` from the `booking`
namespace like the rest of `/book`. Copy is correct da/en but lives outside the
catalog. Add the keys to `messages/{da,en}.json` and switch to `useTranslations`.

### SlotPicker label sets are duplicated across four call sites
The admin English label object is defined near-identically in
`admin-request-card.tsx` (`SLOT_LABELS` + derived `OVERRIDE_LABELS`),
`admin/new/_components/time-step.tsx`, and a third da/en set in
`booking-slot-step.tsx`. Adding or renaming a `SlotPickerLabels` field means
editing every copy, and they can drift. Extract a shared admin label builder
(e.g. `adminSlotLabels({ override })`) and keep the client set in the i18n pass
above.

### Schedule editor — deferred polish (after the unified schedule lands)
- **Faint bookings underneath the week grid**: the visual editor shows rules only;
  the design wanted the visible week's real bookings rendered faint behind them so
  hours are edited against actual appointments. Deferred — the non-blocking conflict
  check already covers the safety case. Add via a booking-spans read for the week.
- **Dated "replace a day's hours" isn't expressible**: the `schedule_rules` model is
  additive (a dated `standard` rule UNIONS with the recurring one — it can only ADD
  time; to close/shorten a day you add a `no_work` block). The editor copy now says
  so, but a true "these are the hours on this date instead" would need a model tweak
  (e.g. a dated rule that suppresses the weekday's recurring rules).
- **Migration drops special-OPEN days**: `schedule-rules.sql`'s seed converts weekly →
  standard, no-work → no-work, special-CLOSED → dated full-day no-work, but skips
  special-OPEN days (the additive model can't reproduce their old replace semantics).
  Re-add any as dated rules in the new editor. (No prod data today, so moot for launch.)
- **Conflict label**: a booking stranded by a full-day dated no-work is labelled "now in
  a no-work block" rather than "on a now-closed day" (the `closed` reason only fires when
  a day has no standard rule at all). Cosmetic — both read as blocked.
- ~~**Drop the now-dead schema**~~ — DONE: `supabase/drop-legacy-schedule.sql` drops `studio_hours`
  + `studio_special_days` + their JSONB guard functions; their types are removed from types.ts. Run it
  LAST (after schedule-rules.sql + feature-flags.sql are applied + the new schedule is verified).

### studio_hours single row is read twice per slot computation
`loadSlotInputs` (availability.ts) calls `getStudioHours` (reads `weekly`) **and**
`getOutsideHoursConfig` (reads `no_work`/flag/window) — two SELECTs against the
same single-row `studio_hours`. `getScheduleSnapshot` (conflicts.ts) repeats it.
Hot paths (every /book confirm, reschedule, admin picker). Read all needed columns
in one SELECT. Tiny table (PK lookup) so the win is modest — hence deferred.

### getOutsideHoursConfig returns a camelCase view model (layer leak)
`db/studio-hours.ts` `getOutsideHoursConfig` maps `no_work→noWork`,
`outside_hours_enabled→enabled`, etc. AGENTS.md says db/ returns schema-shaped
snake_case rows and modules map to view models. Move the mapping to the module
(`modules/studio/hours.ts`), return the snake_case row from db/. Ripples to
availability.ts, conflicts.ts, and the admin hours editor — do it in one pass.

### Outside-hours calendar is serialized to every /book visitor
`booking-confirm.tsx` passes the full `outsideSlots` array into the client
`BookingSlotStep` as a prop, so when outside-hours is enabled the whole outside
calendar (closed weekdays yield the entire 06:00–20:00 window each day → ~1–2k
slots over the horizon) ships in the RSC payload for every booking visitor, even
though it's only revealed after clicking "Request one". Lazy-load it: return only
`outsideEnabled` from `getBookingSlots`, and fetch the outside slots from a
`"use server"` action when the client actually opens the request UI.

### In-house booking hardening (before launch)
From the Phase 3a review of `createBooking`:
- ~~**Public-abuse guard** (blocker before launch)~~ — **DONE (2 Sep 2026).**
  `createBooking` and `createBookingRequest` now require a signed-in session and
  take the email FROM it, so a made-up address can no longer create a client row
  or hold a slot. Behind that: the pre-existing honeypot, a durable per-client
  rate limit (`db/rate-limits.ts`), and the 2-active-booking cap. This is the
  sign-in half of feature F in [ROADMAP.md](in-house/ROADMAP.md); guests get a
  card as their second path when G lands. **Apply `supabase/rate-limits.sql`.**
- **Buffer is app-enforced, not DB-enforced**: the `bookings_no_overlap`
  exclusion constraint guarantees no raw overlap, but a rare concurrent race can
  create back-to-back bookings that skip the `buffer_mins` cleanup gap (both pass
  re-validation before either commits). If it matters, bake a fixed buffer into
  the constraint's `tstzrange`.
- **Minor efficiency**: `createBooking` loads the service, then `getAvailableSlots`
  loads it again + regenerates the whole window to test one slot's membership. A
  targeted "is this one slot free" check would avoid the duplicate I/O.
- **Add-on incompatibility is UI-enforced only**: `prepareBooking` filters add-ons
  to live+attached and sums them, but never checks `incompatiblePairs`, so a
  crafted request (or any non-UI caller) can persist an incompatible combo. Both
  create paths rely on the picker disabling clashers. The admin rebook prefill
  now drops clashing pre-selected add-ons client-side, but the real fix is to
  reject incompatible combos server-side in `prepareBooking` (load the pairs, as
  the availability engine already can).

From the Cal-removal (3b/3c) review — low severity, deferred:
- **Reschedule end vs. price drift**: `resolveNewSlotEnd` derives the new `end`
  from *live* availability (current `base_duration_mins` + add-on durations), but
  `rescheduleBookingById` leaves `total_price_cents` as-booked. If a service's
  duration changed after booking, a moved appointment's length reflects the new
  duration while its price stays old. Prefer the as-booked
  `meta.totalDurationMins` snapshot for the new end.
- **Owner can reschedule a no-show without clearing the mark**:
  `rescheduleBookingAsOwner` gates on `isActiveBookingStatus` only; a no-show row
  keeps an active `status` (the mark is `no_show_at`), so the moved appointment
  still renders "no-show". Clear `no_show_at` on owner reschedule.
- **Menu ordering fallback**: featured/menu ordering moved from `cal_event_id` to
  `created_at`; a row with a null `created_at` sorts non-deterministically (the
  column has a `now()` default, so effectively never null today).

### Localize the auth surfaces (login + My space)
`/[locale]/login` (supabase-login-form) and `/[locale]/account` (My space page +
account-actions + the AccountMenu aria/title) are hardcoded **English**. The app
is da-default with next-intl catalogs, so a Danish user sees English there. Add
message keys to `messages/da.json` + `en.json` and route these through
`useTranslations`/`getTranslations` — do both auth surfaces in one i18n pass.

### ~~Consent re-grant~~ — DONE (1 Sep 2026)

Fixed for BOTH flows. The old note was also wrong on the detail: it said "the
server actions already support it (no status guard)", but the current
`media_releases` model has one — `decideMediaRelease` refuses anything that
isn't `requested`, and it returns `{ ok: true }` while doing nothing, so a UI
attempt would have looked like it worked.

That guard is CORRECT and stayed: `/approve/[token]` is a public link, and a
replayed token must never silently re-grant something the client withdrew. The
fix was a separate, signed-in-only path:

- `restoreMediaRelease(bookingId, purpose)` — own release, only from
  `withdrawn`/`declined`, clears the earlier stamps and re-stamps
  `consent_version`. Notifies the studio under a new `media_consent_restored` kind
  (`owner_notifications.kind` has no CHECK, so no migration).
- `my-space.ts` no longer drops a booking once every purpose is answered — that
  was the second lock, and the worse one: the card disappeared, so there was
  nothing to click even if the action had allowed it.
- The card renders the terminal state with "Allow again" beside it.
- Restoring permission does NOT republish. Withdrawal deletes the public copy, so
  the studio places it again — the notification says so.

The paired `grantMediaConsentRow` orphan bug in the old note is moot: that
function belonged to the retired per-image `media_consents` ledger. The
booking-level model has no orphan path, because a re-grant restores the ceiling
and publishing stays a separate, explicit step.

Testimonials got the same treatment when they were built (`restoreTestimonial`).

### withdrawDataConsent doesn't notify owner / revalidate
[consent-actions.ts](../../src/modules/media/consent-actions.ts) `withdrawDataConsent`
only flips status + revalidates `/admin/clients/{id}` — unlike `withdrawMediaConsent`
(notifyOwner + revalidate public surfaces). Latent today (name/testimonial has no
public render yet) but will silently fail to take content down once it ships. Add
`notifyOwner` (extend `OwnerNotificationKind`) + `revalidatePublicSurfaces()`.

### Transactional email (booking confirmation / cancellation / reschedule)
Cal used to email the client on book/cancel/reschedule; removing Cal removed
that, and **no email infra exists** (only Supabase Auth OTP + in-app owner
notifications). Client-facing copy still promises "a confirmation will arrive by
email" (`messages/*.json` `booking.confirmIntro`, `bookings.cancelDialogBody`,
etc.). Build an env-guarded email adapter (Zoho SMTP — the studio's email
vendor), da/en templates for confirm/cancel/reschedule, and wire it into
`createBooking` / `cancelBooking` / `rescheduleBooking`. Until then the copy
over-promises. Degrade to a no-op without SMTP creds (keys added later).

### Don't log raw DB errors on identity/upsert paths (PII)
`ensureUser` / `insertBooking` on the `createBooking` path log verbatim DB error
messages; a unique violation on `clients.email` can echo the email
(`Key (email)=(…)`) into logs. Log error codes, not full messages.

## Done

### Blocked-booking states → a request flow (Feature H) ✅
The confirm-step dead ends are now request flows: the **2-active cap** →
over-limit request form (+ "check My Space"), and **outside-normal-hours** →
"Can't find a time?" → SlotPicker of outside slots. Both send `booking_requests`
the artist approves in the admin queue. Built, unmerged (SQL pending).

### Admin booking: override availability limits ✅
`/admin/new` **and** the request Adjust dialog have an **"Ignore hours & days
off"** toggle → a picker of free times across the override envelope (06:00–22:00,
hours/no-work/lead ignored, taken slots still excluded). Client flow stays
limited. Built, unmerged.

### Withdrawn-consent notification opens the image dialog ✅
A `media_consent_withdrawn` notification now links to
`/admin/assets?highlight=<client_media_id>`, and `highlight` **auto-opens** that
image's asset dialog (previously it only scrolled + ringed the card). The admin
lands straight on the per-purpose state, the "Confirm taken down" action, and the
usage manager (where it's used).
- [notifications/page.tsx](../../src/app/admin/notifications/page.tsx) — `hrefFor(n)`
- [asset-hub-tabs.tsx](../../src/components/admin/asset-hub-tabs.tsx) → [hub-asset-card.tsx](../../src/components/admin/hub-asset-card.tsx) — `autoOpen` prop
