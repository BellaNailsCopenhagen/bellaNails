# Follow-ups — noted, fix later

Small fixes/enhancements captured mid-work. Not blocking; pick up when convenient.

### In-house booking hardening (before launch)
From the Phase 3a review of `createBooking`:
- **Public-abuse guard** (blocker before launch): `createBooking` is a public
  service-role write with no auth/rate-limit — an attacker can spam bookings +
  junk `clients` rows and fill the calendar. Add rate-limiting / captcha /
  honeypot (Cal had bot protection; we removed it).
- **Buffer is app-enforced, not DB-enforced**: the `bookings_no_overlap`
  exclusion constraint guarantees no raw overlap, but a rare concurrent race can
  create back-to-back bookings that skip the `buffer_mins` cleanup gap (both pass
  re-validation before either commits). If it matters, bake a fixed buffer into
  the constraint's `tstzrange`.
- **Minor efficiency**: `createBooking` loads the service, then `getAvailableSlots`
  loads it again + regenerates the whole window to test one slot's membership. A
  targeted "is this one slot free" check would avoid the duplicate I/O.
- **Phase 3b coupling**: making the bookings Row types nullable + updating the
  appointment cards (cancel/reschedule → in-house actions, React key off
  `cal_booking_id`) MUST happen before a UI wires `createBooking`.

### Localize the auth surfaces (login + My space)
`/[locale]/login` (supabase-login-form) and `/[locale]/account` (My space page +
account-actions + the AccountMenu aria/title) are hardcoded **English**. The app
is da-default with next-intl catalogs, so a Danish user sees English there. Add
message keys to `messages/da.json` + `en.json` and route these through
`useTranslations`/`getTranslations` — do both auth surfaces in one i18n pass.

### Consent re-grant (GDPR: re-granting must be as easy as withdrawing)
Withdrawn/declined consents can't be re-granted from the UI. The server actions
already support it (`decideMediaConsent`/`decideDataConsent` have no status
guard), but nothing surfaces a withdrawn/declined item: media inbox lists only
`requested` ([consent-centre.tsx](../../src/components/.../consent-centre.tsx)),
the gallery manage dialog only `granted`. Add an "Allow again" control wired to
`decide*Consent(..., "granted")`.
- **Paired bug**: `grantMediaConsentRow` ([consent-actions.ts](../../src/modules/media/consent-actions.ts)) on re-grant of a *used-&-withdrawn* photo sets a NEW `published_asset_id` without clearing `needs_takedown_at` or reusing/cleaning the old asset → orphans the old `assets`/`asset_usages` + Scaleway object and leaves a stale "used & withdrawn" flag. Fix alongside: clear `needs_takedown_at` + reconcile the existing asset.

### withdrawDataConsent doesn't notify owner / revalidate
[consent-actions.ts](../../src/modules/media/consent-actions.ts) `withdrawDataConsent`
only flips status + revalidates `/admin/clients/{id}` — unlike `withdrawMediaConsent`
(notifyOwner + revalidate public surfaces). Latent today (name/testimonial has no
public render yet) but will silently fail to take content down once it ships. Add
`notifyOwner` (extend `OwnerNotificationKind`) + `revalidatePublicSurfaces()`.

### Retire the Cal phone read-through
`booking-phones.ts` `fetchCalPhones` still runs on every admin list render, but
`clients.phone` now exists (populated by `ensureUser`). One-time backfill
`clients.phone` from Cal for historic clients, then drop `fetchCalPhones` + its
branch in `resolveAdminBookings` — removes a per-render Cal call and stops
re-exposing phone to Cal.

### Don't log raw DB errors on identity/upsert paths (PII)
`booking-sync.ts` + the Cal webhook log verbatim DB error messages; a unique
violation on `clients.email` can echo the email (`Key (email)=(…)`) into logs.
Log error codes, not full messages, on the identity/upsert paths.

## Done

### Withdrawn-consent notification opens the image dialog ✅
A `media_consent_withdrawn` notification now links to
`/admin/assets?highlight=<client_media_id>`, and `highlight` **auto-opens** that
image's asset dialog (previously it only scrolled + ringed the card). The admin
lands straight on the per-purpose state, the "Confirm taken down" action, and the
usage manager (where it's used).
- [notifications/page.tsx](../../src/app/admin/notifications/page.tsx) — `hrefFor(n)`
- [asset-hub-tabs.tsx](../../src/components/admin/asset-hub-tabs.tsx) → [hub-asset-card.tsx](../../src/components/admin/hub-asset-card.tsx) — `autoOpen` prop
