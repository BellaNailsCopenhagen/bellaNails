# Exploration — Client PWA (nice to have)

> Status: **exploration, not committed.** Owner idea (July 2026): a client-
> facing installable app to streamline rebooking and managing sessions.
> This brief scopes the investigation, not the build. Read
> [`../admin/00-context.md`](../admin/00-context.md) for the PWA groundwork
> the admin ships first — the client PWA would reuse all of it (manifest
> pattern, service worker, push plumbing, subscription table).

## The core insight to validate first

The client site already IS the app in all but installability: booking flow,
my-bookings, in-app reschedule/cancel, next-appointment card. The cheapest
version of this idea is **make the existing site installable** (manifest +
icons + install nudge on /bookings for signed-in repeat clients) — hours,
not weeks, once the admin PWA lands. Everything else below layers on top.
Validate whether clients actually install before investing further.

## Candidate features (owner's list + suggestions), by leverage

**Cheap, high value — likely the v1:**
- **Installable client PWA** — as above; the repeat client opens "Bella
  Nails" from her home screen straight into /bookings.
- **Appointment reminders via push** — reuses the admin push plumbing
  (Task 05) 1:1: same VAPID keys, same subscription table keyed to the
  client's `clerk_user_id`, a scheduled trigger (cron) for "24 h before"
  / "2 h before". Overlaps with the branded-email reminders decision — do
  BOTH channels or pick one; a push reminder can carry the reschedule
  deep link.
- **One-tap rebook** — "book again" already exists; the PWA version is a
  push/home-screen shortcut: "Time for your next set?" N weeks after the
  last completed session (interval per service; the artist knows the
  cadence — infill vs new set). Genuinely fits the business.
- **Add to calendar (.ics)** — not push at all, but solves the same "don't
  forget" problem with zero infrastructure; belongs in /confirmation and
  the branded emails regardless of this exploration.

**Medium effort — needs a decision:**
- **Direct message line to the artist.** ⚠️ Tension with the standing
  decision "email-first, internal messaging is overkill". Lightweight
  options in order of effort: (a) `mailto:` deep links everywhere (done);
  (b) a per-booking "send a note" that emails the studio with booking
  context prefilled — no inbox to build, still feels in-app; (c) a real
  thread table + admin inbox — REAL cost (unread states, notifications
  both ways, moderation of expectations: is the artist expected to reply
  mid-session?). Recommendation: (b) first; (c) only if volume proves it.
- **Waitlist for cancellations** — "tell me if Saturday frees up": a
  `slot_watches` table + the existing BOOKING_CANCELLED trigger point →
  push to watchers. High client value for a fully-booked artist; pairs
  naturally with the out-of-hours request flow (also deferred to admin).

**Careful — brand decision required:**
- **Coupons/offers.** ⚠️ The services page currently states: *"We do not
  operate discount structures or promotional pricing."* Coupons contradict
  the stated positioning. Alternatives that fit quiet luxury: a **loyalty
  gesture** (e.g. every Nth session includes a free add-on), **referral
  thank-yous**, or a **birthday note** — framed as generosity, not
  discounting. Whatever is chosen must also reconcile with Cal owning
  payment-less bookings today (prices are informational; redemption would
  be handled at the studio, which keeps it simple). Needs the owner's
  brand call before any build.

**Other candidates surfaced:**
- **"My sets" photo history** — after each session the artist snaps the
  result (admin gallery upload flow, Task 04) and optionally attaches it to
  the booking; clients see their own history. Emotional value, feeds the
  public gallery pipeline, cheap once Task 04 exists.
- **Aftercare notes** — per-service care instructions on /confirmation and
  in the PWA; content, not code.
- **Apple Wallet pass** for the appointment — high polish signal, moderate
  effort (pass signing); revisit post-launch.

## Questions the exploration must answer

1. Install rate: do clients add the PWA when nudged? (Instrument the nudge.)
2. Push opt-in rate on iOS (requires install first — the funnel is real).
3. Which ONE feature drives rebooking: reminders, rebook nudges, or waitlist?
4. The coupons brand question — owner decision, not research.
5. Does any of this change the Clerk plan (MAU growth) or need new vendors?
   (Goal: zero new vendors — everything above works with the current stack.)

## Non-goals

- Native/store apps, chat infrastructure, payments-in-app — out unless the
  exploration produces overwhelming evidence.
