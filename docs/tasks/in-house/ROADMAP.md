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

### E · Feature-flag admin UI  — **DEFERRED**
- **The flag *config* already exists** (`src/config/features.ts` — env on/off for
  serviceDetail, serviceGallery, homeShowcase, reviews, testimonials, favorites).
  What's missing is an **artist-facing toggle panel** (so the artist flips features
  without env vars) + confirming the base/optional split with the owner. A thin UI
  over existing config, not new machinery.

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

## Reconciled from the master plan ([PLAN.md](../../PLAN.md)) — not-yet-built
PLAN.md predates the in-house migration, so ignore its **Cal.com / Clerk mechanics**
(retired). These forward items were in it and are **not** covered above:

### I · Insights — income & occupancy overview  — **NOT BUILT** (Task 10)
Owner-only `/admin/overview` (a "More → Insights" link exists; the page doesn't):
monthly **revenue** = Σ effective income of *completed* appointments · per-appointment
**income override** (`income_override_cents`, never overwrites the booked price) ·
**occupancy %** (footprint = duration + 30-min buffer ÷ working minutes). Big "info
only — not accounting" disclaimer. Reuses studio-hours (now first-class).

### J · Testimonials system  — **NOT BUILT** (Phase 7/8)
`testimonials` table + **client-submitted** ("Share your experience" + prompt cards +
`testimonial_requests`) + artist **publish/decline** + home section switches i18n→DB.
NOTE: `reviews` (studio-entered, per-service) already exists and is **separate**. This
subsumes "request testimonial" in B.

### K · Local SEO  — **NOT BUILT** (Phase 10 + [seo-plan.md](../../seo-plan.md))
On-page: `LocalBusiness`/`NailSalon` **JSON-LD** · **sitemap** + robots · **hreflang**
+ canonical · per-locale titles/desc · keyworded h1 · crawlable NAP + areas-served ·
image alts · **FAQ + FAQPage schema**. Off-page: Google Business Profile, citations,
review engine. High-leverage for "neglesalon Ørestad". Blocked on: public phone,
final domain, geo, social URLs.

### L · Launch hardening  — **NOT BUILT** (Phase 9)
Final **legal-content** review (real terms/privacy text — owner) · a11y/Lighthouse +
no-flicker · prod env wiring + full booking smoke test · **SETUP.md** dev runbook ·
**consolidate schema** into one ordered `supabase/schema.sql`.

### M · Media performance  — **NOT BUILT**
Scaleway has **no CDN / image transforms** — the photo gallery is the likely dominant
load. Pre-size/optimize + record an LCP/TTFB baseline before/after.

### Candidates / opens
- **Artist CRM notes** on a client — PLAN recommends owner-only + minimal (not shown
  to clients); currently deferred. (Booking-level `client_notes` exists; per-client
  artist notes don't.)
- **ICS calendar feed** (read-only, signed) — the artist lost her external calendar
  when Cal went; a phone-calendar feed is the cheap replacement.
- **Waitlist / cancellation backfill** — cheap once we own slots (client-PWA idea).
- **Studio-proposal → client-accept** (`origin` + `client_accepted_at`) — if the owner
  wants studio bookings the client confirms, vs the confirmed-directly path we built.
- **H starter SQL exists** — `supabase/booking-requests.sql` (update `clerk_user_id` →
  `client_id`, then apply).

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
