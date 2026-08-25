# Build roadmap — decisions + the features still to build

The master list. Consolidates the scheduler ([SCHEDULER-OPTIONS.md](SCHEDULER-OPTIONS.md))
and card-hold ([CARD-HOLD.md](CARD-HOLD.md)) plans with the latest decisions.

## Decisions (this round)
**Build now:** communication history + manual reminder · admin-triggered requests
(review / testimonial / guest video-approval) · client + admin **push** with
channel preferences.

**Deferred:** reminder **cron** (the manual button covers it until volume grows) ·
the **feature-flag switchboard** (the app is already conservative — reviews are
studio-entered, client uploads never auto-publish — so it's not urgent).

---

## Features still to build

### A · Communication history + manual reminder  — **BUILD NOW**
- `communications` log table — one row per transactional email (client, kind,
  booking, recipient, sent_at, status/error). **Metadata only**, wiped on GDPR erasure.
- Log every send at the email sender (confirm / cancel / reschedule / reminder).
- Admin view (per client + per booking): what went out, with a **Resend** action.
- **"Send reminder(s)"** button — per booking, or "send tomorrow's batch".
- Connected: **Zoho SMTP** (live).

### B · Admin-triggered requests  — **BUILD NOW**
- **Request review** — *open decision:* on-site review form (needs owner-approve-
  before-publish, since reviews are studio-entered today) **vs** a link out to
  Google/external. MVP leans external or studio-entered to avoid unmoderated UGC.
- **Request testimonial** — email the client; studio enters the reply via the
  existing `addReview` (studio-entered) path.
- **Request video approval (non-registered clients)** — HMAC token → public
  "approve this video" page. Reuses the guest booking-manage token pattern + the
  media-consent module.
- Connected: **Zoho SMTP** (live).

### C · Push notifications (client + admin) + channel preferences  — **BUILD NOW (largest)**
- PWA service worker + **Web Push** (VAPID). PWA shell already exists (manifest + icons).
- `push_subscriptions` table + subscribe/permission UI (client My Space + admin).
- Send pipeline: push on booking confirm / reminder / requests; admin push on new
  booking + requests.
- `communication_preferences` — per client: channel (email / push), opt out of
  reminders. Extends the existing `communication_locale`.
- **Open decision:** pure **Web Push / VAPID** (no vendor, more code) vs
  **OneSignal / Firebase FCM** (a vendor, less code).
- Connected: **Web Push/VAPID** *(or OneSignal/FCM)** — to add.

### D · Reminder scheduler (cron)  — **DEFERRED**
- Flip the manual reminder route (A) to a daily fixed-time cron. Nothing to build
  now; it's a one-line trigger swap onto the same route.
- Connected (when built): **Vercel Cron** / **Supabase pg_cron** / **Upstash QStash**
  — see [SCHEDULER-OPTIONS.md](SCHEDULER-OPTIONS.md).

### E · Feature-flag switchboard  — **DEFERRED**
- `studio_settings` / `feature_flags` row + admin toggles: client uploads, public
  gallery, public reviews, review requests, guest video approval. Enforce the rule
  "no client content goes public without owner approval". Follows the existing
  single-row `booking_settings` pattern.

---

## Separately planned (pre-existing — still to build)

### F · Guest spam gate — validated-identity-OR-card  — **PLANNED**
- The guest gate: returning signed-in (clean) → free; guest → **sign in (validate
  email)** or **add a card**. The **email/sign-in half can ship now** (reuses
  Supabase OTP) as the interim spam layer; the card half = G.
- Connected: **Supabase Auth** (live) + **Stripe** (G).

### G · Card-hold (Stripe authorization hold)  — **PLANNED (big)**
- `platform/stripe` adapter (hold / capture / release / saveCard); webhook; card
  step in `/book`; `bookings` payment columns; terms gate; **capture on no-show**
  (into `setBookingNoShow`). Fork A far-future holds depend on the scheduler (D).
- The no-show *layer* on top of the spam gate (F). See [CARD-HOLD.md](CARD-HOLD.md).
- Connected: **Stripe** (new) + scheduler (D, for far-future holds).

### H · Overflow + outside-hours booking requests  — **PLANNED (later)**
- `booking_requests` mechanism: client requests a 3rd booking (past the 2-active
  cap) or an outside-normal-hours slot → **artist approves** ("time not
  guaranteed"). One shared approval flow for both.
- Connected: **Zoho SMTP** + push (C).

---

## Smaller outstanding — [FOLLOWUPS.md](../FOLLOWUPS.md)
- Localize the auth surfaces (login + My Space) — still English on a da-default app.
- Consent **re-grant** UI + the paired orphan bug (`grantMediaConsentRow`).
- `withdrawDataConsent` — add owner-notify + revalidate.
- Minor: buffer DB-enforcement · `createBooking` duplicate I/O · menu-order null fallback.

---

## Connected services (summary)
| Service | Status | Used by |
| --- | --- | --- |
| **Supabase** (DB / Auth / RLS) | live | everything |
| **Zoho SMTP** | live | all email — A, B, reminders |
| **Scaleway S3** | live | media storage |
| **Web Push / VAPID** *(or OneSignal / FCM)* | to add | C (push) — vendor decision open |
| **Stripe** | to add | G (card-hold), F (card half of the spam gate) |
| **Scheduler** (Vercel Cron / pg_cron / QStash) | to add — **deferred** | D (reminder cron), G (far-future holds) |

## Suggested build order
1. **A** (comms log + manual reminder) — backbone; kills cron urgency.
2. **B** (request buttons) — small, reuses A's email + existing patterns.
3. **F email-half** (require sign-in *or* card; ship the sign-in gate now) — cheap spam win.
4. **C** (push + preferences) — largest; do after the email flows are proven.
5. Then **G** (Stripe card-hold), **H** (booking requests), and un-defer **D/E** as needed.
