# What's left — 8 Sep 2026

Successor to [RELEASE-PLAN.md](RELEASE-PLAN.md), which is now the record of the
sweep rather than the list. Everything below is open; ids are carried over
unchanged so earlier commits still refer to the same thing.

Split as before: **Human** = only you or Veronica can do it. **Code** = I can.
MoSCoW is against the next release, not forever.

| | Human | Code | Total |
| --- | --- | --- | --- |
| **Must** | 6 | — | 6 |
| **Should** | 6 | 2 | 8 |
| **Could** | 1 | 11 | 12 |
| **Won't (this release)** | — | 5 | 5 |

Code-side, **Must is empty and Should is down to two items — both of which need
a browser I don't have.** What stands between here and R1 is content, a domain
and a deploy.

---

# MUST — all yours

| # | What | Why it matters |
| --- | --- | --- |
| H1 | **Point `bellanails.dk` at Vercel** | Deploys go Ready but the domain resolves to the old host. A green deploy is not a live site. |
| H2 | **`NEXT_PUBLIC_SITE_URL` → `https://bellanails.dk`** | It holds `https://test.bellanails.dk`. Until it changes the site deploys as staging and refuses crawlers by design — nothing is indexable. |
| H3 | **`pnpm deploy:prod`** | `deploy` is merged and green at every gate; the command is classifier-blocked for me. |
| H4 | **Real terms + privacy (v2)** | Both still open by telling the reader they are drafts, and clients accept them at step 03. The only item with legal exposure. |
| H8 | **Test Google sign-in end to end** | Never exercised. It is the first button on the login screen. |
| H9 | **Images + copy for `/gallery` and the service pages** | `gallery_items`, `service_sections` and `reviews` are all empty, and both surfaces are linked from the main nav. C2 and C3 wait on this, not on code. |

---

# SHOULD

## Should · Human

| # | What | Why it matters |
| --- | --- | --- |
| H12 | **Claim + fill the Google Business Profile** | Primary category "Neglesalon" is the biggest local ranking factor. On-page work only makes her eligible; GBP is the local pack. |
| H13 | **Core citations, identical NAP** | Krak, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places. Consistency IS the signal. |
| H14 | **Social URLs** | All three blank, so the footer shows no social column and the JSON-LD carries no `sameAs`. |
| H15 | **Phone number + geo coordinates** | Deliberately omitted from the schema rather than guessed — Google displays a telephone from structured data. |
| H20 | **Give `BOOKING_TOKEN_SECRET` its own value** | It falls back to the service-role key, so every emailed manage / approve / offer / testimonial link is signed with it. Rotating that key would kill all of them at once. Any long random string. |
| H17 | **Env + data tidy** | Drop `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` (read by nothing — storage is Supabase Storage), set `HUMAN_CHECK_SECRET` and `GOOGLE_REVIEW_URL` if you want those two features on, and clear the QA test rows. |

## Should · Code — both blocked on a browser

| # | What | Why it's stuck |
| --- | --- | --- |
| C5 | **Media performance baseline** | Needs a real LCP/TTFB measurement on the photo-heavy pages. There is no browser in my environment, so I can measure nothing — and building an optimisation without a number is how you optimise the wrong thing. Pre-sizing already happens in the browser on upload; the open question is only whether Supabase's image transforms earn their keep. |
| C6 | **A11y + Lighthouse pass** | Same. I can reason about markup and did (labels, `aria-required`, `aria-hidden` on decorative marks), but a Lighthouse score and a keyboard/screen-reader walk need the real thing. |

Hand me either as a set of numbers, or run them and paste the report — both are
then ordinary work.

---

# COULD

| # | Who | What |
| --- | --- | --- |
| D1 | Human | **Five open decisions.** Root locale (`/` → always `/da`? — unblocks C14) · admin stays English-only · keep or hide the "card on file" NOT-AVAILABLE radio · should a future appointment appear in the permissions list · a cancelled future booking filing under History. |
| C7 | Code | **What triggers housekeeping.** No scheduler in the stack; `/admin` being opened most days *is* the trigger and the exposure is a quiet week. Accept it in code, or add one. |
| C14 | Code | **`/` always `/da`** — one line, waiting on D1. |
| C15 | Code | **Resend on the communications log.** Feature A is otherwise complete; resend is the missing verb. |
| C16 | Code | **ICS calendar feed (signed).** She lost her external calendar with Cal. Confirmations already attach an `.ics`; a subscribable feed is the cheap replacement. |
| C17 | Code | **Waitlist / cancellation backfill.** Cheap now we own the slots. Turns a cancellation into a booking. |
| C18 | Code | **`design_requests` admin list.** The queue shows open + offered only; closed and booked are reachable only through the client's page. |
| C19 | Code | **Faint bookings behind the hours grid.** The design wanted the week's real appointments behind the rules. The conflict check already covers the safety case. |
| C20 | Code | **Dated "replace a day's hours".** `schedule_rules` is additive — to shorten a day you add a `no_work` block. A true replace needs a model change. |
| C21 | Code | **Buffer in the DB constraint.** `bookings_no_overlap` stops raw overlap, but a rare concurrent race can skip the cleanup gap. Needs SQL, so yours to apply. |
| C24 | Code | **Orphan sweep past 1000 objects.** Fine at this volume; revisit if `media-refs` grows. |
| C26 | Code | **Keep marking required fields** as forms gain them. Nothing to do today — the pattern is `components/admin/field-label.tsx`. |

---

# WON'T — this release

| # | What | Why not now |
| --- | --- | --- |
| W1 | **Push notifications + channel preferences** | Largest remaining feature, and an open vendor decision (Web Push/VAPID vs OneSignal/FCM). Prove the email flows are wanted first. |
| W2 | **Stripe card-hold** | The card half of the spam gate. Sign-in already closes the hole it was for. |
| W3 | **Reminder cron** | The manual batch covers it, which is why it was deferred. |
| W4 | **Client PWA** | Validate install intent before investing past a cheap v1. |
| W5 | **Blog / local content, social posting** | Real ongoing work, no code, and it needs H12 first. |

---

## Done in this sweep

Nine code items, one at a time, each reviewed and merged on its own branch.

| # | What |
| --- | --- |
| C8 | Withdrawing name/testimonial permission notifies the studio and revalidates — it would have shipped broken alongside the render it protects. |
| C9 | The booking-request copy joined the catalogue; no client-facing text left outside `messages/*.json`. |
| C10 | Audited the eleven remaining service-role callers — all correct — and wrote the invariant as a test that catches the next one. |
| C11 | The conflict check can no longer build its own service-role client. |
| C22 | Client upload and message limits count in Postgres, not per instance. |
| C23 | One set of admin SlotPicker labels instead of two. |
| C25 | The request picker offers the length accepting will book. |
| C27 | A shared service link shows the service, its price and its duration. |
| C4 | The outside-hours calendar is fetched when she opens it. |

**Three items were already fixed** and the lists hadn't caught up — worth knowing,
because it was the third time this sweep:

- **C12** (clear `no_show_at` on owner reschedule) and **C13** (reschedule
  sizing from the as-booked snapshot) — both done by `595f3cd` on 29 Aug.
- **QA-16** (server-side add-on incompatibility) — done by `946263b`, nine days
  before the QA pass that reported it.

So: verify a finding against the code before working it. Every item above was
checked first, which is why this sweep produced nine changes rather than twelve.
