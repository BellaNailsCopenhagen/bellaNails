# Terms, Acceptance Tracking & Media Overview

> **File paths below predate the Aug 2026 restructure.** `src/lib/**` and
> `src/components/sections/` no longer exist; the layers are now `app/`, `modules/`,
> `db/`, `platform/`, `shared/`. This document is kept as a record of the work as it
> was done — for current locations see [architecture.md](../../architecture.md).

Autonomous build (owner away). Every phase: `tsc` + `eslint` + `build` → **review skill** → commit → deploy. This doc is the record of decisions, changed files, and the test plan.

## Goal (from the owner)
1. Terms pages — **service** (booking) and **data usage** (privacy/media).
2. Register acceptance; track **per user, exactly when** they accepted service terms and data-use terms **at the media level**.
3. Expose terms in the flows that need them; add to **footer** + **booking** page.
4. **DB table** for terms; **admin page** to manage/update terms (versioned).
5. Admin user page: show each user's accepted terms (general + media).
6. Admin user **media overview**: owner/site/social tags become **icon overlays on the image** (nicer gallery).
7. Upload: "Attach to booking (optional)" moves into a **dialog** behind an Upload button; only **past/current completed** bookings selectable.

## Key constraints discovered
- **Admin area is English-only**, lives at `src/app/admin/...` (NOT under `[locale]`). Public pages are localized under `src/app/[locale]/...`.
- **Bookings come from Cal.com** via webhook/sync → `persistCalBooking` (`src/lib/booking-sync.ts`); the booking flow is **signed-out**; `clerk_user_id` is minted there from the Cal email. `booking-confirm.tsx` is a server component wrapping Cal's iframe — no app submit handler. Consent today is implicit ("by reserving you agree to our <terms>").
- **No `completed` booking status.** `bookingState(row, now)` (`src/lib/booking-display.ts`): `no_show_at`→no-show, `status='cancelled'`→cancelled, else `end_time >= now ? open : completed`. Active statuses = confirmed | rescheduled.
- Upload uses `uploadMedia` (`src/lib/client/upload-media.ts`, sign → POST) then an `addClientMedia`/`addOwnBookingMedia` action. Sheet (not Dialog) is the modal primitive; mirror `create-service-sheet.tsx`.

## Decisions
- **Schema** (`supabase/terms.sql`, written): `terms(kind service|data, version, title/body _en/_da, is_current)` — one current per kind (partial unique idx); `terms_acceptances(clerk_user_id, terms_id, kind, version, context, reference_id default '', accepted_at)` — unique `(clerk_user_id, kind, reference_id)` so recording is idempotent. Public-read terms; owner+own read acceptances. Seeded a v1 draft per kind so the flow works day one (owner replaces text in admin).
- **Routes**: `/terms` (service, already in routes.ts + linked from booking-confirm) and `/privacy` (data) — add `routes.privacy`.
- **Body format**: plain text / light markdown; render paragraphs by splitting on blank lines (no new dependency).
- **Acceptance recording**:
  - *Service*: in `persistCalBooking` (best-effort, try/catch — never break booking persist), record `kind=service`, `reference_id=booking.id`, `version` = current service terms, `context='booking'`. Idempotent via the unique key. Degrades if migration not yet applied.
  - *Data (media level)*: in `grantMediaConsentRow` (`client-consent.ts`) — when a client grants a media consent, record `kind=data`, `reference_id=client_media_id`, `version` = current data terms, `context='media_consent'`. Covers single decide + accept-all.
- **Admin terms management**: `/admin/terms` (English-only) — per kind, edit bilingual title/body; **Save publishes a new current version** (version+1) so acceptances pin to a version. Show version history read-only.
- **Admin user page**: a "Terms accepted" panel — service (version + date) and data (per-photo list or count + latest date).
- **Media overlays**: replace the text status badges under each image with corner **icon overlays** (studio/owner mark; website/globe; social/share) tinted by state (granted/requested/none).
- **Upload dialog**: `ClientMediaGallery` upload form → a Sheet opened by an "Upload media" button; booking `<select>` filtered to **started + active** bookings (`start_time <= now && isActiveBookingStatus`), i.e. past or current completed.

## Phases
- **A** — terms foundation: types.ts, `src/lib/terms.ts` reads, `manage-terms.ts` actions, `/admin/terms` page + editor, admin nav link.
- **B** — public pages + wiring: `/terms`, `/privacy`, shared `TermsView`, footer legal links, booking-confirm links both, i18n.
- **C** — acceptance recording + admin visibility: `recordTermsAcceptance` helper, wire into `persistCalBooking` + `grantMediaConsentRow`, admin user "Terms accepted" panel.
- **D** — admin media icon overlays.
- **E** — upload Sheet + booking filter.

## Progress
- **Phase A+B — DONE** (committed `124949f` + deployed). Terms system + public pages live.
- **Phase C/D/E — built**, reviewed, committed together.

## Versioning note (owner-confirmed)
Terms are **never edited in place** — every save publishes a NEW version
(`saveTermsVersion` inserts version+1 and swaps `is_current`). History is
immutable, so `terms_acceptances` pinning `terms_id` + `version` + `accepted_at`
to a `clerk_user_id` gives one source of truth with historic accuracy: we can
show exactly which text a client agreed to and when.

### Phase C/D/E test plan
7. Book a session (Cal webhook/sync) → `terms_acceptances` gets a `service` row
   for that booking (version = current). Admin client page → "Terms accepted"
   shows `Service terms · v{n} · {date}`.
8. Client grants a photo publish consent (single or Accept-all) → a `data` row
   per photo. Panel shows `Data-use terms · N photos · latest {date}`.
9. Both recordings are best-effort: with the migration unapplied, booking +
   consent still succeed (no crash), panel shows "Not recorded".
10. Admin client Gallery: each thumbnail shows corner icons — source (studio/
    client), website (globe) + social (share) tinted by consent state (green/
    amber/red/faint). Hover title spells out the state.
11. "Upload media" opens a dialog (caption + attach-to-booking + file). Booking
    picker lists ONLY past/current, non-cancelled, non-no-show sessions. Upload
    closes the dialog and the new photo appears (router.refresh).

## Test plan
### Phase A+B (terms system + public pages)
1. Apply `supabase/terms.sql`. `/en/terms` + `/da/terms` render the service terms; `/en/privacy` + `/da/privacy` render the data terms; both locales + "Last updated" footnote.
2. Footer shows a **Legal** column (Terms, Privacy) in both locales, linking correctly.
3. Booking confirm step fine print links **both** terms of service and privacy notice (both locales).
4. `/admin/more` shows a **Terms** entry → `/admin/terms`. Owner-gated (signed-out/non-owner can't reach it).
5. In `/admin/terms`: edit service terms → Publish → version bumps, history shows new current, `/terms` reflects it immediately (force-dynamic). Same for data → `/privacy`.
6. Before migration applied: pages show the localized "being prepared" fallback (no crash); admin shows "No version yet — create".

## Changed files
### Phase A+B
- `supabase/terms.sql` (new) — **MIGRATION**, apply via Supabase MCP/SQL editor, then confirm types.ts.
- `src/lib/supabase/types.ts` — `terms` + `terms_acceptances` table types.
- `src/lib/terms.ts` (new) — reads + localize helpers.
- `src/lib/actions/manage-terms.ts` (new) — `saveTermsVersion` (owner, publishes next version).
- `src/components/admin/terms-editor.tsx` (new) — bilingual Sheet editor + version history.
- `src/app/admin/terms/page.tsx` (new) — admin management page.
- `src/app/admin/more/page.tsx` — Terms hub entry.
- `src/components/sections/terms-view.tsx` (new) — public renderer (paragraph split).
- `src/components/sections/legal-page.tsx` (new) — shared page impl (terms + privacy).
- `src/app/[locale]/terms/page.tsx` + `src/app/[locale]/privacy/page.tsx` (new).
- `src/config/routes.ts` — `privacy` route + Legal footer column.
- `src/components/sections/booking-confirm.tsx` — `<privacy>` link chunk.
- `messages/{en,da}.json` — `legal` ns, `nav.terms/privacy`, `footer.legal`, updated `booking.consent`.

### Phase C/D/E
- `src/lib/terms-acceptance.ts` (new) — `recordTermsAcceptance` (best-effort, idempotent) + `getTermsAcceptances`.
- `src/lib/booking-sync.ts` — record `service` acceptance on booking persist (captures booking id).
- `src/lib/actions/client-consent.ts` — `grantMediaConsentRow` takes clerkUserId, records `data` acceptance per photo (single + accept-all).
- `src/components/admin/client-terms-panel.tsx` (new) — admin "Terms accepted" overview.
- `src/app/admin/clients/[id]/page.tsx` — load acceptances + render panel; booking picker filtered to attachable (started, active, non-no-show) sessions.
- `src/components/admin/client-media-section.tsx` — icon overlays on thumbnails; upload moved into a Sheet dialog (+ router.refresh on success).

## Migrations to apply
- [ ] `supabase/terms.sql` — creates `terms` + `terms_acceptances`, seeds v1 drafts. Apply, then regenerate/confirm types.ts.
