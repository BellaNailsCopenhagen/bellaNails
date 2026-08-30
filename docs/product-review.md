# Product review — what we built, what it's worth, what's next

> PM pass over the whole app, 30 Aug 2026. Written from the codebase + plan docs.
> **Caveat up front:** there is **no analytics in the app** (no Plausible/PostHog/
> Vercel Analytics — checked). Every usage claim below is a reasoned estimate, not
> a measurement. Fixing that is item 0 of the backlog.

---

## 1. TL;DR — the image-upload question

**Client image upload, as built today, will not bring real value. The mechanism is
right; the moment and the direction are wrong.**

Today: a signed-in client opens My Space → a past appointment → uploads a photo of
their finished set. Intent: feed the public gallery.

Why it under-delivers:

| Problem | Detail |
| --- | --- |
| Brutal funnel | sign in → return after the appointment → find My Space → find the past row → pick a photo → upload. Then the artist must request a release, and the client must grant it. Six steps for one image. |
| Wrong photographer | Bella shoots the set in-studio, in good light, at peak. A client's one-handed phone photo three days later is worse — and the brand is "quiet luxury". Most uploads would never clear the publishing bar. |
| Not the bottleneck | The marketing-content pipeline is already solved from the artist's side: admin upload → release → asset hub → publish. Client uploads add supply we don't need, at the lowest quality tier. |
| Guest-invisible | `/api/media/sign` requires a signed-in caller, and the upload only appears on *past* bookings. Guest bookers — a large share of a public funnel — never see it. |

**Realistic yield:** at ~10–20 appointments/week, maybe 1 publishable client photo a
month. That is not a feature; that is a rounding error.

### Where client images are genuinely valuable

Same plumbing, different moment — **before the appointment, not after**:

1. **Inspiration photo at booking** (the big one). Nail clients already send Pinterest
   and Instagram screenshots — today over DM, where Bella has to babysit a second
   inbox. Bringing it in-app:
   - sets expectations → kills the "that's not what I asked for" failure mode;
   - lets Bella judge complexity → **correct duration and price**. Our scheduler assumes
     a fixed duration per service; elaborate nail art is the #1 cause of overrun. This is
     a direct occupancy and revenue lever, not a nice-to-have;
   - lets her prep colours, charms, tools before the client arrives;
   - plugs straight into the **existing `booking_requests` approval flow** — "this design
     needs +30 min, accept with adjusted time".
2. **Problem photo before a repair** — "a nail broke, can you fix it?" A photo decides
   20-minute repair vs. full new set, i.e. which service and slot length to book. Pairs
   with the outside-hours request flow.
3. **Wear / warranty claim after the appointment** — "it lifted after three days".
   This *is* the current post-appointment upload, and it is its real justification.
   The differentiators copy already promises a **studio guarantee**; nothing in the app
   supports a claim against it.

### Recommendation

- **Keep** the post-appointment upload. **Reframe** its copy from "share your set"
  (marketing) to "show us how it's wearing" (guarantee/service). Zero new code, and it
  starts backing a promise we already make on the home page.
- **Build** the inspiration upload at booking time. It reuses ~everything: browser
  downscale + EXIF strip, presigned POST, `client_media`, the `booking_id` link, the
  admin viewer, GDPR erasure. New work is contained (see backlog #2).
- **Do not** invest another day in client photos as a content pipeline.

⚠️ One rule for inspiration photos: they are usually **someone else's work**, so they
are internal-only — never publishable, never in the release flow, and auto-purged a
set period after the appointment.

---

## 2. What we've built

### Client-facing (public, da/en)

| Feature | State | PM read |
| --- | --- | --- |
| Home — hero, services, formula, differentiators, studio gallery, showcase, testimonials, find-us | live | Solid. Two content bugs — see §5. |
| Personalised bands (next appointment, pending-requests banner) | live | Good retention touch, cheap. |
| Service menu + categories | live | Core. |
| Service detail pages (sections, gallery, reviews, price history) | live | Rich. Reviews are **studio-entered** — weak as social proof. |
| Booking funnel (service → add-ons → details → slot → confirm) | live | The product. Month calendar, add-on step auto-skipped, guest or signed-in. |
| Booking requests (over-limit + outside-hours → artist approves) | built, unmerged | Strong differentiator for a one-artist studio. Unusual to have; keep. |
| Confirmation + `.ics` + maps link | live | Right call — solves "don't forget" with no infra. |
| Manage booking — guest via signed token, 24 h policy window | live | Table stakes, done properly. |
| My Space — appointments / gallery / requests / settings | live | Good. Gated on sign-in, so guests get none of it. |
| Client photo upload (past bookings) | live | **See §1.** |
| Media releases — per-booking, per-purpose, withdrawable | live | Best-in-class for GDPR. Over-built relative to the supply of photos it governs. |
| Terms + privacy, versioned, acceptance-tracked | live | Genuinely strong. Rare at this size. |
| Auth — Supabase (Google + email OTP) | live | Login/My Space still **English-only** on a Danish-default app. |
| Transactional email (confirm / cancel / reschedule / reminder, da+en) | live | Zoho SMTP. Reminder is **manual-trigger only**. |

### Admin (English-only, mobile-first)

| Feature | State | PM read |
| --- | --- | --- |
| Command centre home (now / next, requests, live queue) | built, unmerged | Right home screen for a working artist. |
| Agenda, appointments history + filters | live | Fine. |
| New booking (owner-created, rebook prefill, ignore-limits override) | live | Essential — walk-ins and phone bookings. |
| Reschedule / cancel / no-show mark | live | Complete. |
| Booking-request review (adjust time, accept & book, reject + reason) | built, unmerged | Good. |
| Clients — directory, search by name/phone/email, client detail, GDPR anonymise | live | Strong. **No per-client artist notes** (only booking-level). |
| Services — CRUD, add-ons, incompatibilities, categories, sections, images, price history | live | Very complete. Arguably the most over-built area vs. a menu that changes rarely. |
| Asset hub — states, favourites, publish, placements, takedown | live | Excellent machinery. Under-fed (see §1). |
| Working hours — unified schedule rules, visual calendar + stepper | built, unmerged | Big win. Replaces two legacy tables. |
| App settings — feature flags | built, unmerged | 1 flag today. Framework is there. |
| Terms editor (versioned publish) | live | Done. |
| Notifications inbox + communications log with resend | live | Good. |
| Manual "send tomorrow's reminders" | live | **Depends on Bella remembering.** See backlog #1. |

### Not built (already on the plan)

Insights (income + occupancy) · testimonials system · push notifications · reminder cron ·
Stripe card-hold / deposits · local SEO + Google Business · gallery & testimonials
curation page · waitlist · artist ICS feed · per-client CRM notes.

---

## 3. Table stakes we're missing

What a client booking a nail appointment in Copenhagen generally expects, and we don't have:

| Missing | Why it hurts | Effort |
| --- | --- | --- |
| **Automatic reminder** | We send reminders only when Bella clicks a button. Every missed click is a potential no-show. The single biggest no-show lever, and the send pipeline already exists. | XS |
| **A way to send a reference photo** | Clients will do this over Instagram regardless. Right now it goes to a channel the app can't see. | S–M |
| **Reviews from actual clients** | Home testimonials are invented placeholders (§5); service reviews are studio-typed. There is no real social proof anywhere. | M |
| **Findability (local SEO)** | No JSON-LD, no sitemap, no hreflang, no public phone number. "neglesalon Ørestad" is the whole acquisition game for a studio like this. | M |
| **Waitlist / cancellation alert** | A fully-booked artist turns people away and then loses a cancelled slot. Both sides lose money. | M |
| **Rebook nudge** | Gel needs an infill every 3–4 weeks. Nothing prompts it. This is the top LTV lever in nails and we do nothing with it. | S–M |
| **Deposit / no-show protection** | Planned (Stripe), not built. Only worth it once no-shows are measured. | L |
| **Allergy / health note at booking** | HEMA allergy, pregnancy, nail conditions. Safety + liability, and it's one field. | XS |
| **Public opening hours that match reality** | The home page hard-codes "Monday–Saturday · 09:00–18:00" while the studio now edits a rich schedule in admin. They will drift. | S |
| **SMS** | Danish salons lean on SMS; we're email-only. Not urgent, but a known reach gap. | M |

---

## 4. Opportunity backlog — scored

Value = 1–5. Effort: XS <½ day · S 1–2 days · M 3–5 days · L 1–2 weeks.

| # | Opportunity | Client | Studio | Effort | Verdict |
| --- | --- | --- | --- | --- | --- |
| 0 | **Basic analytics** (funnel: view → book, upload usage, install) | – | 5 | XS | **Do first.** We are flying blind; every item below is a guess without it. |
| 1 | **Reminder cron** — flip the existing manual route to a daily trigger | 5 | 5 | XS | **Do now.** Highest ROI in the list. |
| 2 | **Inspiration photo at booking** | 5 | 5 | S–M | **Do next.** The image-upload pivot. |
| 3 | **Rebook nudge** ("time for your infill") — per-service cadence + email | 4 | 5 | S–M | **Do.** Retention, uses the email stack we own. |
| 4 | **Local SEO + Google Business** | 2 | 5 | M | **Do.** Biggest growth lever; nothing else brings new clients. |
| 5 | **Waitlist / cancellation backfill** | 5 | 4 | M | Do after 1–4. Real revenue, moderate build. |
| 6 | **Real testimonials system** (client-submitted, artist-approved) | 3 | 4 | M | Do — and it removes the §5 risk. |
| 7 | **Insights** (income + occupancy) | 1 | 5 | M | Do. `income_override_cents` already exists; it's a read + a page. |
| 8 | **Artist ICS feed** (signed, read-only) | 1 | 4 | S | Cheap. Bella lost her phone calendar when Cal went. |
| 9 | **Per-client artist notes** (colours, cadence, preferences) | 2 | 4 | S | Cheap CRM win for a relationship business. |
| 10 | **Allergy / health field at booking** | 3 | 4 | XS | Cheap. Safety + liability. |
| 11 | **Aftercare content per service** | 4 | 3 | S | Content, not code. Fewer failures, feeds SEO/FAQ. |
| 12 | **"Send a note about this booking"** (emails the studio with context) | 3 | 3 | S | The cheap answer to "can I message the artist?" — no inbox to build. |
| 13 | **FAQ page + FAQPage schema** | 3 | 4 | S | SEO + deflects DMs. |
| 14 | **Push notifications + PWA install** | 3 | 3 | L | **Defer.** Only after reminders prove out and install rate is measured. |
| 15 | **Stripe deposit / card hold** | 1 | 4 | L | **Defer.** Friction + brand cost. Revisit once no-shows are measured. |
| 16 | **Gift cards** | 4 | 4 | L | Needs payments first. Strong Danish Christmas driver — revisit with #15. |
| 17 | **Loyalty / referral gesture** | 3 | 3 | M | Brand call needed — the services page says we don't discount. Frame as generosity (free add-on, birthday note), not coupons. |
| 18 | **SMS channel** | 3 | 3 | M | New vendor. Only if email reminders under-perform. |

---

## 5. Free wins — fix before launch

Found while reading the code. All cheap, all currently wrong:

1. **The home testimonials are invented.** Three quotes with names and job titles
   ("Astrid H., Architect, Copenhagen") hardcoded in `messages/{da,en}.json` and rendered
   on the home page. Fabricated testimonials are prohibited under EU/Danish consumer
   marketing rules. **Launch-blocking** — pull them or replace with real ones (#6).
2. **Public opening hours are hardcoded copy**, disconnected from the schedule system we
   just built. Drive them from `schedule_rules`, or the first schedule change makes the
   site lie.
3. **No public phone number** anywhere (email only). Needed for local SEO NAP anyway.
4. **Login and My Space are English-only** on a Danish-default app. Already in FOLLOWUPS.
5. **No analytics.** Item 0 above.
6. A stale `home.tagline` string still reads "Online booking opens soon" — appears unused,
   but worth deleting so it can't resurface.

---

## 6. Recommended order

1. **Analytics** (#0) — half a day, unblocks judgement on everything else.
2. **Reminder cron** (#1) — the pipeline exists; this is a trigger swap.
3. **Fix the fake testimonials + hardcoded hours** (§5) — launch hygiene.
4. **Inspiration photo at booking** (#2) — the image-upload feature that actually pays.
5. **Rebook nudge** (#3) + **local SEO** (#4) — the growth pair: keep the clients we have,
   get found by the ones we don't.

Everything else waits for numbers.
