# Release plan — everything still outstanding (8 Sep 2026)

One list, gathered from every planning doc in the repo, the live database and the
live environment, then checked against the code. Supersedes the scattered todo
lists — see [§ Stop reading these](#stop-reading-these) at the bottom.

Split the way the work actually divides: **Human** = only Raul or Veronica can do
it (a dashboard, a decision, a piece of real content). **Code** = I can do it.

Priority is MoSCoW **for the next release**, not forever. `R1` is the gate.

Counts are what is still **open** — struck rows below are done.

| | Human | Code | Total |
| --- | --- | --- | --- |
| **Must** | 6 | — | 6 |
| **Should** | 6 | 12 | 18 |
| **Could** | 2 | 11 | 13 |
| **Won't (this release)** | — | 5 | 5 |

H17 is excluded (test data you're clearing before release), and the
environment variables have their own table below rather than a row each.

**H5, H6 and H7 are done** — hours are correct in the admin, and the duplicate
services and the cartoon on `/gallery` were mock data. C2 and C3 are waiting on
images and copy rather than on code, so Must-code is empty.

---

## The three gates

| | Gate | Means |
| --- | --- | --- |
| **R1** | **A stranger can book, safely** | The domain is live, the legal text is real, the menu has no duplicates, and nothing a client can reach is empty or lying. |
| **R2** | **Strangers can find her** | The off-page half of the SEO plan: Google Business Profile, citations, a review habit. Code-side this is mostly done. |
| **R3** | **Growth** | Push, card-hold, waitlist. None of it blocks a paying client. |

---

## Environment — what Vercel has, and what it's missing

Audited today: every `process.env.*` the code reads against the nine variables
on the project. Nothing here blocks a deploy; two things are switched off
because of it.

| Variable | State | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://test.bellanails.dk` | **H2.** Every canonical, the sitemap and robots.txt derive from it. While it is not `https://bellanails.dk` the deploy is a staging copy, and the code now refuses crawlers entirely rather than competing with the real domain. |
| `HUMAN_CHECK_SECRET` | **missing** | **H10.** Bot protection cannot run: the box is never shown and bookings are never asked for a proof. App settings and the boot log both say so. |
| `GOOGLE_REVIEW_URL` | **missing** | **H11.** "Request review" renders as an inert control instead of a button. |
| `BOOKING_TOKEN_SECRET` | **missing**, falls back to `SUPABASE_SERVICE_ROLE_KEY` | **H20.** Signed links work — but rotating the service-role key would invalidate every outstanding manage, approve, offer and testimonial link at once. Worth its own secret before that matters. |
| `BUSINESS_ADDRESS_LINE_1` `_2`, `BUSINESS_CONTACT_EMAIL`, `BUSINESS_BOOKING_FROM_EMAIL`, `BUSINESS_ALERT_EMAIL` | missing | Fine. These are only the fallback for a blank `business_profile` field, and the live row is filled in. |
| `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` | set, **read by nothing** | **H19.** A leftover from the retired storage migration — storage is Supabase Storage, and there is not one Scaleway or S3 reference left in `src/`. Delete it; it is the only thing still claiming otherwise. |

---

# MUST

## Must · Human

| # | What | Why it matters | Where |
| --- | --- | --- | --- |
| H1 | **Point `bellanails.dk` at Vercel** | Deploys go Ready but the domain still resolves to the old host. Nothing below is live until this is. A green deploy is not a live site. | Vercel → Domains |
| H2 | **Set `NEXT_PUBLIC_SITE_URL` to the live domain in Vercel** | It currently holds **`https://test.bellanails.dk`**. Every canonical, hreflang, the sitemap and the robots `Sitemap:` line are built from it, so until it is `https://bellanails.dk` the site deploys as a staging copy — which the code now handles by refusing crawlers entirely (`Disallow: /` + `noindex`). Nothing is indexable until this changes. | Vercel → Env |
| H3 | **Run `pnpm deploy:prod`** | `deploy` is **25 commits** behind `main` — the whole QA remediation is unreleased. The command is classifier-blocked for me. | terminal |
| H4 | **Publish real terms + privacy (v2)** | Both documents currently open by telling the reader they are drafts, and clients are recorded as accepting them at step 03. This is the one item with legal exposure. Old acceptances keep pointing at the text they agreed to. | `/admin/terms` |

| H8 | **Test Google sign-in end to end** | The provider + redirect URI have never been exercised. If it is misconfigured, "Continue with Google" fails for every client — and it is the first button on the login screen. | Supabase → Providers |
| H9 | **Fill the service detail pages, or say to drop the link** | Every service links "læs mere" to a page with no sections, no gallery and no reviews. Five near-empty pages reachable from the menu. Content is yours; dropping the link is C3. | `/admin/services/[id]` |

## Must · Code

Both remaining Must-code items turned out to be content, not code — kept here
so the gate is honest about what is still missing from R1.

| # | What | Why it matters | Effort |
| --- | --- | --- | --- |
| C2 | **`/gallery` — waiting on images, not on code** | Images are coming before launch, so it is not hidden. Worth knowing: while `gallery_items` is empty the page is a heading over blank space and it IS in the sitemap. Harmless today because the staging host refuses crawlers; revisit only if launch arrives with the table still empty. | — |
| C3 | **Service detail pages — waiting on images + copy** | Same: content is coming, so "læs mere" stays. The pages render sections, a gallery and reviews the moment there are any. | — |

---

# SHOULD

## Should · Human

| # | What | Why it matters | Where |
| --- | --- | --- | --- |

| H12 | **Claim + fill the Google Business Profile** | The single biggest local ranking factor is the primary category "Neglesalon". On-page work only makes her *eligible* to rank; GBP is what puts her in the local pack. | Google |
| H13 | **Submit core citations with identical NAP** | Krak.dk, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places. Consistency is the ranking signal. | external |
| H14 | **Add the social URLs** | All three blank, so the footer shows no social column and the JSON-LD carries no `sameAs`. | `/admin/business` |
| H20 | **Give `BOOKING_TOKEN_SECRET` its own value** | It falls back to the service-role key today, so every emailed manage / approve / offer / testimonial link is signed with it. Rotating that key — which you'd want to be able to do freely — would kill every outstanding link. Any long random string fixes it, before there are links in the wild worth keeping. | Vercel → Env |
| H15 | **Give me the phone number + geo coordinates** | Deliberately omitted from the `NailSalon` schema rather than guessed — Google *displays* a telephone from structured data, so a placeholder is worse than none. | — |
| H17 | **Two clients called Raul, and the QA leftovers** | Two rows, 2 and 3 bookings, separate emails. Plus one cancelled 12 Sep booking left by the pass. Notifications already cleared. **Your call — being cleaned before release, so not tracked here.** | `/admin/clients` |

## Should · Code

| # | What | Why it matters | Effort |
| --- | --- | --- | --- |
| C4 | **Lazy-load the outside-hours calendar** | When outside-hours is on, the whole outside calendar (closed weekdays yield the entire window each day — roughly 1–2k slots over the horizon) ships in the RSC payload for **every** booking visitor, though it is only revealed after clicking "Request one". This is the main funnel, and speed is a local ranking factor. | Medium |
| C5 | **Media performance baseline** | Feature M's premise is out of date: storage is **Supabase Storage**, not Scaleway, and pre-sizing already happens in the browser on upload (`optimizeImage` / `optimizeVideo`). What is left is an actual LCP/TTFB measurement of the photo-heavy pages, and then a decision on whether Supabase's image transforms are worth turning on. Measure before building anything. | Small |
| C6 | **A11y + Lighthouse pass, no-flicker** | Part of launch hardening (L). Cheap to do once, expensive to retrofit. | Medium |

| C10 | **Audit the other 11 service-role callers** | QA-18 gated the nine reads it named. Eleven more module files build a service-role client without a gate and **most of them should** (`ensure-user`, `availability`, token-validated reads). Each needs its own judgement before anyone assumes service-role means admin. | Medium |

| C14 | **Root locale: make `/` always `/da`** | Needs H-side confirmation first (see D1). Today `/` negotiates from Accept-Language, so an English browser lands on `/en` — defensible, but this is a Danish-first studio. | Trivial |

| C26 | **Mark required fields in the rest of the admin** | Done for the seven forms whose actions refuse without them. The schedule-rule stepper, the gallery sheet, the section manager and the blocklist have no *unmarked* required field today, but if one gains one it needs `FieldLabel required` — the pattern is in `components/admin/field-label.tsx`. | Trivial |

---

# COULD

| # | Who | What | Note |
| --- | --- | --- | --- |
| D1 | Human | **Confirm the open decisions** | Root locale (→ C14) · admin stays English-only · keep or hide the "card on file" NOT-AVAILABLE radio · should a future appointment appear in the permissions list · a cancelled future booking filing under History. All five are cheap once answered. |
| C7 | Code | **Decide what triggers housekeeping** — no scheduler in the stack. `/admin` being opened most days *is* the trigger; the exposure is a quiet week. Accept it and say so in the code, or add one (`in-house/SCHEDULER-OPTIONS.md`). |  |
| C15 | Code | **Resend action on the communications log** | Feature A is otherwise built (log + per-client view + manual reminder batch). Resend is the missing verb. |
| C16 | Code | **ICS calendar feed (read-only, signed)** | She lost her external calendar when Cal went. Confirmation emails already attach an `.ics`; a subscribable feed is the cheap replacement. |
| C17 | Code | **Waitlist / cancellation backfill** | Cheap now that we own the slots. Turns a cancellation into a booking. |
| C18 | Code | **`design_requests` admin list page** | The `/admin` queue shows `open` + `offered` only; closed and booked ones are reachable only through the client's page. |
| C19 | Code | **Faint bookings behind the week grid** | The hours editor shows rules only. The design wanted the week's real appointments faint behind them, so hours are edited against reality. The conflict check already covers the safety case. |
| C20 | Code | **Dated "replace a day's hours"** | The `schedule_rules` model is additive — to shorten a day you add a `no_work` block. The editor copy says so; a true replace needs a model tweak. |
| C21 | Code | **Bake the buffer into the DB constraint** | `bookings_no_overlap` guarantees no raw overlap, but a rare concurrent race can produce back-to-back bookings that skip the cleanup gap. |
| C22 | Code | **Move the last per-process rate limits to the durable one** | `/api/media/sign`, design messages and the housekeeping throttle still use the in-memory limiter. Fine until one is actually abused. |

| C24 | Code | **Orphan sweep past 1000 objects** | Fine at the studio's volume; revisit if `media-refs` grows. |

---

# WON'T — this release

Not "no". Just not before a paying client.

| # | What | Why not now |
| --- | --- | --- |
| W1 | **C · Push notifications + channel preferences** | The largest remaining feature, and it carries an open vendor decision (Web Push/VAPID vs OneSignal/FCM). Email flows are proven; prove they are *wanted* first. |
| W2 | **G · Stripe card-hold** | The card half of the spam gate. Sign-in already closes the hole it was for. Big, and it adds a vendor. |
| W3 | **D · Reminder cron** | The manual "Send reminders" batch covers it, which is exactly why it was deferred. A one-line trigger swap when it matters. |
| W4 | **Client PWA** | Scoped in `explorations/client-pwa.md`. Validate install intent before investing past the cheap v1. |
| W5 | **Blog / local content, social posting pipeline** | SEO phase 2. Real ongoing work, no code, and it needs H12 first to have anywhere to point. |

---

## Already done, in case a doc says otherwise

Checked against the code and the live database today:

- **The whole QA remediation** — 20 items, merged to `main`, gate green. `docs/tasks/qa-2026-09/PLAN.md`
- **QA-16 was a false finding.** Add-on incompatibility has been enforced server-side since 946263b (29 Aug), in three places. FOLLOWUPS still lists it as open — it isn't.
- **Server-action codes reaching clients as raw strings** — fixed by QA-13.
- **Login + My Space localisation** — done by QA-13 (`/account` no longer exists; My Space is `/appointments`).
- **PII in identity logs** — `ensureUser` logs the error *code* only.
- **Transactional email** — Zoho SMTP live, seven template modules, communications log.
- **E · Feature-flag admin UI** — built (`/admin/settings`). The dead `config/features.ts` was deleted in QA-20; the DB-backed system is the live one.
- **I · Insights** — built, with month snapshots (12 rows).
- **J · Testimonials** — built, empty.
- **K · Local SEO, technical half** — sitemap, robots, canonical + hreflang, `NailSalon` JSON-LD. QA-12.
- **`rate-limits.sql`** — applied (the table has rows). The QA plan asked to confirm it; confirmed.
- **`studio_hours` / `studio_special_days`** — dropped. Two FOLLOWUPS entries about reading them are moot, and `supabase/outside-hours.sql` must never be run.
- **`insights-months.sql`** — applied, despite its header still saying NOT YET APPLIED.
- **Consolidated `supabase/schema.sql`** — exists.

## Stop reading these

| Doc | Status |
| --- | --- |
| `docs/tasks/TOMORROW.md` | **Stale.** Describes the Clerk→Supabase cutover morning. Every step is done; the "6-digit code" line is wrong (codes are 8 digits, and no screen states a length any more). |
| `docs/PLAN.md` | **Historical.** The master build plan, largely ✅. Its remaining ⬜ items are written against Clerk and Cal.com, both retired — read it as a record, not a todo list. |
| `docs/tasks/storage-scaleway-migration.md` | **Record.** Says so itself; paths predate the restructure. |
| `docs/tasks/in-house/ROADMAP.md` | **Mostly current** for features A–M, but A/B/E/I/J are further along than it says. |
| `docs/tasks/FOLLOWUPS.md` | **Current, minus the closed items listed above.** |

---

## Shipped since this plan was written (8 Sep)

- **C1 · the design offer price** — `parseKroner` instead of `Number()`, so
  1.200 kr is 1.200 kr. Pinned by a test. The only item on the list that was
  costing money while it sat.
- **The database is one file again.** `supabase/schema.sql` had drifted to 12 of
  35 tables, carried a retired table, and had an ordering bug that meant it had
  never once run. Rebuilt by replaying every migration against an empty
  Postgres and dumping the result, then verified by restoring into a second
  empty database and diffing the catalogs — 662 objects, identical. Runbook:
  [DATABASE.md](DATABASE.md). Added H18 (five dead columns to drop) as the only
  remaining difference between live and a clean bootstrap.
- **Phone is no longer required to book.** Nothing sends an SMS or places a
  call, so a number the studio cannot use was blocking bookings. Still asked
  for, still validated if given.
- **The admin says which fields are required.** Marked from what each action
  actually refuses, across seven forms, with `aria-required` on the inputs.
- **A staging deploy no longer competes with the real domain.** Production's
  `NEXT_PUBLIC_SITE_URL` is `https://test.bellanails.dk`, which was harmless
  until the SEO surface shipped a crawlable `robots.txt` and a self-canonical on
  every page. Off the production host it is now `Disallow: /` plus `noindex,
  nofollow`. The host rule is pure and tested, including the lookalike case
  (`bellanails.dk.evil.example` ends with the production host — which is why it
  parses the hostname rather than calling `endsWith`).
- **H16 + H18 applied by Raul**, and verified: the `testimonial` surface is
  refused by a check constraint, the five dead columns are gone, and a fresh
  `schema.sql` bootstrap now matches live **exactly** — 292 columns, zero drift.
  "Clean slate" and "live" are the same thing as of today.