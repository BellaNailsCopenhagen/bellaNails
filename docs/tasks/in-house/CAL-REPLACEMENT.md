# Cal.com replacement — in-house booking + email system (plan)

Comprehensive plan to retire Cal.com. Two pillars: an **in-house booking
engine** and a **transactional email system** (templates, a reminder queue +
cron, automated event emails, and email-only consent for account-less clients).
Companion to `DECISION.md` (the booking-facade design) and
`AUTH-IMPLEMENTATION.md` (identity is now Supabase — `client_id`). **Plan only —
nothing built yet. Start after auth is confirmed working.**

## What we're replacing
- The Cal.com embed (client booking) + the Cal webhook `/api/webhooks/cal` →
  `booking-sync.ts` upsert of `bookings`, and reschedule/cancel via Cal.
- Email is not yet wired for transactional sends (ZeptoMail/Zoho is the adopted
  vendor — [[prefers-minimal-vendor-stack]]).
- Consent today requires the client to **log in** to grant (asset hub ↔ client
  dialog). We add an **email path** for clients with no account.

## Reuse (don't rebuild)
- **`studio_hours`** (weekly + special days) is the availability denominator —
  `hoursForDate(hours, date)` already resolves open ranges per date.
- **`bookings`**, **`services`/`addons`** (multi-service + add-ons), the admin
  queue/appointments UI, `booking-display.ts`, `booking-reputation.ts`.
- The consent **grant/withdraw** logic in `lib/actions/client-consent.ts` +
  `manage-media.ts` (auto-place-on-grant) — the email flow drives the same code.
- `ensureUser({email})` (create-or-find `clients` by email) for guest bookers.

---

## Pillar 1 — Booking engine (`src/modules/booking/`)

Every component calls the facade, never a provider (per DECISION.md):
```
getAvailableSlots(serviceId, addonIds, dateRange): Slot[]
createBooking(input): BookingResult        // input: services, addons, start, contact
rescheduleBooking(bookingId, newStart): BookingResult
cancelBooking(bookingId): BookingResult
getBooking(id) / listBookings(clientId, filter)
```

**Data**
- Add a `booking_settings` singleton: slot interval, min lead time, max advance,
  buffer between bookings. (Bookable hours = `studio_hours` open ranges.)
- Extend `bookings` for add-ons + computed duration as needed.
- **Double-booking guarantee = a Postgres EXCLUSION constraint** on `bookings`:
  `btree_gist` over `tstzrange(start_time, end_time)` `WHERE status IN (active…)`
  (predicate mirrors `isActiveBookingStatus`). The DB rejects overlaps — app
  checks are UX only.

**Slot generation** — generate in **Europe/Copenhagen, store/compare in UTC**
(DST-safe). Per day in range: open ranges from `hoursForDate` → subtract active
bookings, lead time, max-advance, buffers → step by the slot interval → return
free start times. Total duration = service + Σ add-ons + buffer.

**CRUD** — `createBooking` inserts and relies on the exclusion constraint as the
race guard (catch the violation → "slot just taken"); create-or-find client via
`ensureUser`; then enqueue the confirmation email + schedule reminders.
Reschedule/cancel update status, then cancel/re-enqueue that booking's pending
emails.

**UI** — replace the Cal embed with an in-house flow: pick service(s)+add-ons →
date → slot → contact (prefilled from `getCurrentUser` when logged in; guests
allowed) → confirm. Admin gets create/edit on top of the existing queue —
including a fast **"book next session"** for the client currently in the studio.
This in-studio, artist-initiated rebooking is the **primary rebooking path** (no
email needed), so make it quick: prefill the current client + service.

---

## Pillar 2 — Transactional email system (`src/platform/email/` + `src/modules/email/`)

### Provider
**Reuse an already-paid SMTP — no new vendor/cost.** Send via **Zoho Mail SMTP**
(or **DanDomain** SMTP — whichever hosts the domain's email, for SPF/DKIM
alignment). This is the same SMTP Supabase Auth uses, so one config covers both.
`src/platform/email/send.ts` is a thin, env-guarded SMTP wrapper (`to, subject, html,
text`) — **degrade-without-keys**: no creds → log, don't throw
([[build-degrade-without-keys]]). Mailbox SMTP has a daily send cap (hundreds–low
thousands/day) which comfortably covers studio volume; only if we ever outgrow it
do we move to ZeptoMail (Zoho's transactional product, ~free) — not now.

### Templates — two tiers, one render pipeline
- **Default templates (code, bilingual da/en, locked)** — a code registry keyed
  by template key (`booking_confirmed`, `reminder`, `consent_request`, …). Usable
  **as-is with zero intervention**, **un-removable** (version-controlled), and
  always carry the **locked details block** (date, time, location, service) so
  key info can never be missing. The baseline every send falls back to.
- **Custom templates (DB, markdown)** — `email_templates` table: `id`, `name`,
  `title` (subject), `body` (markdown), `locale`, `created_at`, `created_by`.
  Artist-authored ad-hoc templates. **Editing UI is deferred** — edit rows
  in-place for now; a preview + constrained WYSIWYG (Tiptap/markdown) comes later.
- **Render pipeline** (`src/modules/email/render.ts`): markdown + merge fields
  (`{{client_name}}`, `{{date}}`, `{{time}}`, `{{location}}`, …) → HTML; defaults
  append the locked details block. One pipeline serves both tiers.

### Communications log + admin send
- **`client_communications`** logs **every** send: `client_id`, `direction`
  ('outbound'), `template_key` / `custom_template_id`, `subject`, `body_html`
  (rendered — exactly what was sent), `to_email`, `status`
  (queued/sent/failed), `sent_at`, `created_by` (system/owner), context
  (`booking_id` / `consent_id`), `provider_message_id`. The source of truth for
  "what did we send this client." Every automated + manual send writes a row.
- **Admin → client → Communications tab**: history (date, subject, status) → view
  full content → **Resend** per item; a **Send email** button picks a template
  (default or custom), auto-fills the client/booking data, previews, and sends.
- **Observability**: the log is full in-app **outbound** visibility. Delivery /
  open / bounce tracking + inbound replies are a later step — plain SMTP only
  reports sent/failed; switch that send path to the **ZeptoMail API** (webhooks)
  if wanted, and inbound needs IMAP/forward ingest. **Deferred** — the log covers
  the core need.

### Queue + cron (reminders + scheduled sends)
- `scheduled_emails` table: `template_key`, `to_email`, `payload` (jsonb merge
  data), `send_at`, `status` (pending/sending/sent/failed/cancelled),
  `attempts`, `booking_id`, `created_at`.
- **Runner**: a protected route `/api/cron/send-emails` picks due `pending` rows
  (`send_at <= now`) with `FOR UPDATE SKIP LOCKED`, sends, transitions status,
  retries with backoff up to a cap. Idempotent (no double-send).
- **Scheduler**: recommend **Supabase `pg_cron` + `pg_net`** to POST the runner
  every ~5 min (no Vercel-plan cron-frequency limits, and the DB is always on).
  Vercel Cron is the simpler fallback if minute granularity isn't needed.
- **Reminders**: on booking create → enqueue rows (e.g. 24 h + 2 h before). On
  reschedule → cancel + re-enqueue. On cancel → cancel that booking's pending.

### Automated event emails
Enqueued (or sent now) from the booking facade / existing server actions:

| Event | To | Trigger |
|---|---|---|
| Booking created (confirmation) | client | `createBooking` |
| Booking rescheduled | client | `rescheduleBooking` |
| Booking cancelled | client | `cancelBooking` |
| Reminder(s) | client | scheduled before start |
| Consent requested (site/social) | client | asset-hub request |
| Testimonial requested | client | admin action |
| Video-usage request | client | admin action |
| Video-recording approval request | client | admin action |
| Consent granted / withdrawn (receipt) | client | grant/withdraw |

### Email-only consent for account-less clients (key flow)
Mirror the current artist↔client flow, but no login required and **one email can
cover multiple requests**:
- `consent_tokens` table: hashed `token`, `client_id`, `expires_at`, `used_at`.
- The consent-request email links to a **public page `/consent/[token]`** (no
  auth) that lists **all** of that client's pending consent requests — each
  image + purpose (website/social) with Grant / Deny (and grant-all). Submitting
  validates the token and applies decisions via the **existing** grant/withdraw
  logic (service-role), triggering auto-place-on-grant just like the in-app path.
- **Batch = one email**: when the artist requests consent for several assets in a
  session, send a single digest email linking to the page listing them all (a
  "send consent email" action in the asset hub covers all pending for that
  client). Account holders can use the same page or the in-app dialog.
- The page also shows granted items + a withdraw control, so withdrawal works by
  email too.

### Other worthwhile email touchpoints (identified)
Must-haves above; value-adds: post-appointment **review/testimonial nudge**,
**consent-withdrawn receipt**, GDPR **data-export/erasure confirmation** (ties to
existing data-consent flows), optional **welcome** on first login. Sequence these
after the core.

A **thank-you / rebooking prompt email is optional / low priority** — rebooking
is expected to happen **in-studio**: the artist books the client's next session
while they're present (the "book next session" admin flow above). Email rebooking
is only a fallback for clients who didn't rebook in person.

---

## Sequenced execution
1. **Email foundation** — `send.ts` (degrade-safe SMTP), the markdown+details
   render pipeline, **bilingual code default templates**, `scheduled_emails` +
   `client_communications` tables, `/api/cron/send-emails` + `pg_cron`.
2. **Wire event emails** onto existing actions (consent requested, testimonial,
   video usage/approval) — no scheduler needed; each logs to
   `client_communications`. Ships value early.
3. **Admin Communications tab** (per client) — history, view content, **Resend**,
   and **Send email** (pick default/custom, auto-fill, preview, send).
4. **Email-only consent** — token page + batch digest email (reuses grant logic).
5. **Booking engine** — `booking_settings`, exclusion constraint, slot gen +
   `src/modules/booking/` service layer (table access in `src/db/`).
6. **Client booking UI** replacing the Cal embed; admin create/edit + "book next
   session".
7. **Reminders** — enqueue on the booking lifecycle.
8. **Retire Cal** — remove the embed, `/api/webhooks/cal`, `booking-sync.ts` Cal
   bits, and `CALCOM_*` env.

**Deferred (not needed for launch):** custom-template **editor** (WYSIWYG +
preview + mandatory-field validation) — edit rows in place until then; email
**open/bounce tracking** (ZeptoMail API) and **inbound replies** (IMAP ingest).

## Guardrails (carry through every phase)
- Timezone: generate Europe/Copenhagen, store/compare UTC.
- Overlaps: DB exclusion constraint is the guarantee, not app checks.
- Mandatory email fields: locked details block, renderer-injected.
- Degrade without keys: no ZeptoMail key → log, never crash.
- Idempotent cron: status transitions + `SKIP LOCKED` + retry cap.
- Everything behind `src/modules/booking/` and `src/modules/email/` (provider-agnostic).

## Owner prerequisites (gather before build)
- SMTP creds from the existing mailbox host (email is on **Zoho**; DNS is at
  **DanDomain**). No new vendor.
- Sender identities (free Zoho aliases, one SMTP login authenticates all):
  **`authentication@`** (or `login@`/`no-reply@`) = Supabase Auth's single sender
  for login codes; **`booking@`** (replyable, monitored) = the app's transactional
  emails (booking/consent/reminders), where `send.ts` sets the From per email.
- Deliverability records in DanDomain DNS for bellanails.dk are **already set**
  (MX→zoho.eu, SPF `include:zohomail.eu`, DKIM `zmail._domainkey`). Only DMARC
  (`_dmarc` TXT) is optional/outstanding. Email host = **Zoho EU** → SMTP host
  `smtp.zoho.eu`.
- Confirm reminder offsets (e.g. 24 h + 2 h) and booking rules (lead time, slot
  interval, buffer, max advance).
- Studio's real working hours entered in `/admin/hours` (already built).
