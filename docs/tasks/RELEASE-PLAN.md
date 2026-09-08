# Release plan — everything still outstanding (8 Sep 2026)

One list, gathered from every planning doc in the repo, the live database and the
live environment, then checked against the code. Supersedes the scattered todo
lists — see [§ Stop reading these](#stop-reading-these) at the bottom.

Split the way the work actually divides: **Human** = only Raul or Veronica can do
it (a dashboard, a decision, a piece of real content). **Code** = I can do it.

Priority is MoSCoW **for the next release**, not forever. `R1` is the gate.

| | Human | Code | Total |
| --- | --- | --- | --- |
| **Must** | 9 | 2 | 11 |
| **Should** | 9 | 11 | 20 |
| **Could** | 1 | 11 | 12 |
| **Won't (this release)** | — | 5 | 5 |

---

## The three gates

| | Gate | Means |
| --- | --- | --- |
| **R1** | **A stranger can book, safely** | The domain is live, the legal text is real, the menu has no duplicates, and nothing a client can reach is empty or lying. |
| **R2** | **Strangers can find her** | The off-page half of the SEO plan: Google Business Profile, citations, a review habit. Code-side this is mostly done. |
| **R3** | **Growth** | Push, card-hold, waitlist. None of it blocks a paying client. |

---

# MUST

## Must · Human

| # | What | Why it matters | Where |
| --- | --- | --- | --- |
| H1 | **Point `bellanails.dk` at Vercel** | Deploys go Ready but the domain still resolves to the old host. Nothing below is live until this is. A green deploy is not a live site. | Vercel → Domains |
| H2 | **Set `NEXT_PUBLIC_SITE_URL` to the live domain in Vercel** | Every canonical, hreflang, the sitemap and the robots `Sitemap:` line are built from it. Wrong value = a sitemap advertising `localhost:3000` to Google. | Vercel → Env |
| H3 | **Run `pnpm deploy:prod`** | `deploy` is **25 commits** behind `main` — the whole QA remediation is unreleased. The command is classifier-blocked for me. | terminal |
| H4 | **Publish real terms + privacy (v2)** | Both documents currently open by telling the reader they are drafts, and clients are recorded as accepting them at step 03. This is the one item with legal exposure. Old acceptances keep pointing at the text they agreed to. | `/admin/terms` |
| H5 | **Confirm the opening hours** | Mon–Fri closed, Sat–Sun 10:00–18:00. Every bookable slot, the JSON-LD Google reads, and the hours page all derive from it. | `/admin/hours` |
| H6 | **Resolve the duplicate services** | *Klassisk Manicure* 350 vs *Den Klassiske Manicure* 320, and *Gel Lak* 450 vs *Shellac / BIAB* 420 — same category, same duration, both live. A client choosing between two prices for one thing. | `/admin/services` |
| H7 | **Remove the cartoon published as client work** | It is on the public `/gallery` as a real client's set. `/admin/assets` → *test · Classic Manicure, 30 Aug* → remove the placement, then confirm takedown so the public copy is deleted. | `/admin/assets` |
| H8 | **Test Google sign-in end to end** | The provider + redirect URI have never been exercised. If it is misconfigured, "Continue with Google" fails for every client — and it is the first button on the login screen. | Supabase → Providers |
| H9 | **Fill the service detail pages, or say to drop the link** | Every service links "læs mere" to a page with no sections, no gallery and no reviews. Five near-empty pages reachable from the menu. Content is yours; dropping the link is C3. | `/admin/services/[id]` |

## Must · Code

| # | What | Why it matters | Effort |
| --- | --- | --- | --- |
| ~~C1~~ | ~~**The design offer sends the wrong price**~~ — **FIXED 8 Sep** — `design-request-card.tsx:312` | `Number("1.200")` is `1.2`, so a **1.200 kr offer reaches the client as 1,20 kr**. Only Danish thousands-grouping-without-decimals is affected (the empty case is already guarded, and `1.200,50` becomes NaN and is refused). `parseKroner` exists for exactly this and is the one caller not using it. Real money, real client. | Trivial |
| C2 | **`/gallery` is empty and now in the sitemap** | `gallery_items` has 0 rows, so a main-nav page renders a heading over blank space — and QA-12 just offered it to crawlers. Either hide the nav entry + drop it from `indexableRoutes` while empty, or wait for content. Hiding is the safe default. | Small |
| C3 | **Drop "læs mere" while the detail pages are empty** | The other half of H9, and the one that does not wait on content. If H9 lands first, skip this. | Trivial |

---

# SHOULD

## Should · Human

| # | What | Why it matters | Where |
| --- | --- | --- | --- |
| H10 | **Set `HUMAN_CHECK_SECRET`** | Bot protection is off. The screen and the boot log now say so plainly, so this is honest rather than silent — but the booking form is still unguarded against a script. | Vercel → Env |
| H11 | **Set `GOOGLE_REVIEW_URL`** | Until then "Request review" renders as an inert control. Reviews are the highest-leverage local-ranking activity in the SEO plan, so this unlocks R2. | Vercel → Env |
| H12 | **Claim + fill the Google Business Profile** | The single biggest local ranking factor is the primary category "Neglesalon". On-page work only makes her *eligible* to rank; GBP is what puts her in the local pack. | Google |
| H13 | **Submit core citations with identical NAP** | Krak.dk, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places. Consistency is the ranking signal. | external |
| H14 | **Add the social URLs** | All three blank, so the footer shows no social column and the JSON-LD carries no `sameAs`. | `/admin/business` |
| H15 | **Give me the phone number + geo coordinates** | Deliberately omitted from the `NailSalon` schema rather than guessed — Google *displays* a telephone from structured data, so a placeholder is worse than none. | — |
| H16 | **Apply `supabase/gallery-surface-cleanup.sql`** | Retires the `testimonial` asset surface. The delete is a no-op (live `asset_usages` holds one row, surface `clients_gallery`); the value is the constraint that stops new ones. | SQL editor |
| H18 | **Apply `supabase/drop-dead-columns.sql`** | Five columns live carries that nothing reads (`services.cal_event_slug`, four on `feature_flags`). Applying it makes a fresh `schema.sql` bootstrap and the live project the same shape — the only difference between them today. Regenerate `types.ts` after. | SQL editor |
| H17 | **Two clients called Raul, and the QA leftovers** | Two rows, 2 and 3 bookings, separate emails. Plus one cancelled 12 Sep booking left by the pass. Notifications are already cleared. | `/admin/clients` |

## Should · Code

| # | What | Why it matters | Effort |
| --- | --- | --- | --- |
| C4 | **Lazy-load the outside-hours calendar** | When outside-hours is on, the whole outside calendar (closed weekdays yield the entire window each day — roughly 1–2k slots over the horizon) ships in the RSC payload for **every** booking visitor, though it is only revealed after clicking "Request one". This is the main funnel, and speed is a local ranking factor. | Medium |
| C5 | **Media performance baseline + pre-sizing** | Scaleway has no CDN and no image transforms, so photos are the likely dominant load. Record LCP/TTFB before and after. Feature M. | Medium |
| C6 | **A11y + Lighthouse pass, no-flicker** | Part of launch hardening (L). Cheap to do once, expensive to retrofit. | Medium |
| C7 | **Give the housekeeping job a trigger** | `runDesignHousekeeping` is throttled to hourly and fires only when someone opens `/admin`. If nobody does, offers never expire and reference photos are never purged. One cron trigger. | Small |
| C8 | **`withdrawDataConsent` doesn't notify or revalidate** | Unlike `withdrawMediaConsent`. Latent today because name/testimonial has no public render — it will silently fail to take content down the day one ships. | Small |
| C9 | **Booking-request copy into the catalogue** | `booking-request-form.tsx` + `booking-slot-step.tsx` use a hand-rolled bilingual map instead of `t()`. The copy is correct da/en, so this is drift risk rather than a visible bug — the last client-facing text outside the catalogues after QA-13. | Small |
| C10 | **Audit the other 11 service-role callers** | QA-18 gated the nine reads it named. Eleven more module files build a service-role client without a gate and **most of them should** (`ensure-user`, `availability`, token-validated reads). Each needs its own judgement before anyone assumes service-role means admin. | Medium |
| C11 | **`studio/conflicts.ts` defaults its client to service-role** | `getScheduleSnapshot(db = createSupabaseServiceRoleClient())`. Every real caller passes a gated client, so it is safe in practice — the default is a bypass waiting for a caller who forgets. Make the parameter required. | Trivial |
| C12 | **Owner reschedule doesn't clear `no_show_at`** | A no-show row keeps an active status, so a moved appointment still renders "no-show". | Trivial |
| C13 | **Reschedule end vs price drift** | The new `end` comes from *live* duration while `total_price_cents` stays as-booked. If a service's duration changed, a moved appointment's length and price disagree. Use the as-booked snapshot. | Small |
| C14 | **Root locale: make `/` always `/da`** | Needs H-side confirmation first (see D1). Today `/` negotiates from Accept-Language, so an English browser lands on `/en` — defensible, but this is a Danish-first studio. | Trivial |

---

# COULD

| # | Who | What | Note |
| --- | --- | --- | --- |
| D1 | Human | **Confirm the open decisions** | Root locale (→ C14) · admin stays English-only · keep or hide the "card on file" NOT-AVAILABLE radio · should a future appointment appear in the permissions list · a cancelled future booking filing under History. All five are cheap once answered. |
| C15 | Code | **Resend action on the communications log** | Feature A is otherwise built (log + per-client view + manual reminder batch). Resend is the missing verb. |
| C16 | Code | **ICS calendar feed (read-only, signed)** | She lost her external calendar when Cal went. Confirmation emails already attach an `.ics`; a subscribable feed is the cheap replacement. |
| C17 | Code | **Waitlist / cancellation backfill** | Cheap now that we own the slots. Turns a cancellation into a booking. |
| C18 | Code | **`design_requests` admin list page** | The `/admin` queue shows `open` + `offered` only; closed and booked ones are reachable only through the client's page. |
| C19 | Code | **Faint bookings behind the week grid** | The hours editor shows rules only. The design wanted the week's real appointments faint behind them, so hours are edited against reality. The conflict check already covers the safety case. |
| C20 | Code | **Dated "replace a day's hours"** | The `schedule_rules` model is additive — to shorten a day you add a `no_work` block. The editor copy says so; a true replace needs a model tweak. |
| C21 | Code | **Bake the buffer into the DB constraint** | `bookings_no_overlap` guarantees no raw overlap, but a rare concurrent race can produce back-to-back bookings that skip the cleanup gap. |
| C22 | Code | **Move the last per-process rate limits to the durable one** | `/api/media/sign`, design messages and the housekeeping throttle still use the in-memory limiter. Fine until one is actually abused. |
| C23 | Code | **Dedupe the SlotPicker label sets** | Near-identical label objects in three call sites; renaming a field means editing every copy. |
| C24 | Code | **Orphan sweep past 1000 objects** | Fine at the studio's volume; revisit if `media-refs` grows. |
| C25 | Code | **Booking-request picker sizes slots from the LIVE service** | While `acceptBookingRequest` uses the request's snapshot duration. Pre-existing, and now inconsistent with the reschedule paths. |

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
