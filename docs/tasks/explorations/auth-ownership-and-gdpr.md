# Exploration — Owning users/login + GDPR (Denmark/EU)

> **File paths below predate the Aug 2026 restructure.** `src/lib/**` and
> `src/components/sections/` no longer exist; the layers are now `app/`, `modules/`,
> `db/`, `platform/`, `shared/`. This document is kept as a record of the work as it
> was done — for current locations see [architecture.md](../../architecture.md).

> Status: **exploration, not committed.** Owner trigger (July 2026): Clerk's
> free plan can't store a client's **phone** (phone isn't an enabled identifier
> and the accounts we mint are never activated as logins), so our
> "PII-lives-in-Clerk" invariant is already broken for phone. This brief scopes
> two linked questions: (1) an immediate new source for the phone, and (2)
> whether to move identity + PII into our own (Supabase) database — and what
> that means for GDPR in Denmark/EU. Not legal advice: validate with Danish
> counsel / [Datatilsynet](https://www.datatilsynet.dk) guidance before acting.
> Related: [`../admin/07-clients.md`](../admin/07-clients.md),
> [`../admin/08-photo-consent.md`](../admin/08-photo-consent.md),
> [`../admin/01-shell-auth-pwa.md`](../admin/01-shell-auth-pwa.md).

## Where the data actually is today

- **Clerk (US)** — owns identity + most PII (name/email/phone), holds the login.
  We store only the pseudonymous `clerk_user_id`.
- **Cal.com (EU, `api.cal.eu`)** — owns the authoritative booking, including the
  **phone as typed by the client** (by `cal_uid`).
- **Supabase (Postgres)** — our `bookings` mirror (PII-free by design), RLS
  owner-reads-all.
- **Zoho (EU)** — transactional email.

The phone reaches Clerk via `persistCalBooking` → `ensureClerkUser` →
`tryAttachPhone`, which **silently fails on the free plan**. But note: the phone
value *passes through our own webhook* (`snapshot.attendeePhone`) and we throw it
away. It is also always re-fetchable from Cal by `cal_uid`.

---

## Part 1 — Getting the phone NOW (the practical fix)

Two ways, independent of the bigger migration:

**A. Read from Cal at display time (no new storage).**
Admin resolves phone from Cal by `cal_uid` (authoritative) alongside the Clerk
lookup. Works for *all* bookings incl. existing; keeps PII out of our DB (best
GDPR posture). Cost: extra Cal API calls on admin views — batch via the Cal v2
list endpoint over the page's date window, not per-uid.

**B. Store it in our DB at webhook time (the data already arrives there).**
Add `attendee_phone` (+ maybe `attendee_name`) to `bookings`, or a `contacts`
table keyed by the client id; write the E.164-normalised value in
`persistCalBooking`. Fast, reliable, no Cal calls at read time. Existing bookings
need a one-time backfill from Cal. **Cost: we now hold PII → GDPR controls apply
(Part 3).**

**Status: A is implemented** (`src/lib/booking-phones.ts` + the merge in
`resolveAdminBookings`) — reversible, no PII stored. **Caveat still to verify:**
A only returns a phone if the Cal event type actually *captures* one (a Phone
booking field); confirm in the Cal dashboard. **B remains the real direction** —
Clerk can no longer be the phone store, so long-term the phone lives either in
Cal (read-through, today) or our DB (B, the first brick of Part 2/the transfer
plan below).

---

## Part 2 — Owning users + login in our database

**Why revisit Clerk:** free-plan limits (no phone, feature gating, MAU caps),
paid cost as clients grow, and — the trigger here — it can't reliably hold the
data the studio needs. It's also a **US processor holding EU PII** (a transfer
liability, Part 3).

**Options (leverage-ordered):**

- **Supabase Auth (recommended — zero new vendors).** We already run Supabase +
  RLS. `auth.users` lives in *our* Postgres; supports email OTP / magic link
  (matches today's passwordless model), phone OTP, and Google/Apple. PII moves to
  a `public.profiles` row keyed to `auth.uid()`; RLS keys off the same id we
  already use. One store, EU-hostable, we control erasure. This is the
  minimal-vendor path the [PWA brief](client-pwa.md) also gravitates to.
- **Better Auth / Auth.js / Lucia** — viable but add a library + more glue than
  Supabase Auth, which is already in the stack.
- **Stay on Clerk (paid)** — buys phone/features but keeps PII with a US
  processor and a recurring bill; doesn't resolve the ownership question.

**What the migration actually touches (auth is load-bearing):**
- Replace `@clerk/nextjs`: middleware, session, `currentUser()`, sign-in/up UI,
  the booking-flow account opt-in, and the **admin owner-role** gate.
- `bookings.clerk_user_id` → a Supabase auth user id. Migrate existing Clerk
  users (export → import) or dual-run during cutover.
- New `profiles` table holds name/email/phone → **we become the direct holder of
  PII** (today Clerk shields us from most of it).
- Owner role: today it's RLS "owner-reads-all"; needs an explicit role
  (custom JWT claim or `profiles.role`) once Supabase issues the tokens.
- `ensureClerkUser` (create-or-find by email in the Cal webhook) → a Supabase
  equivalent that upserts a profile from the booking.

**Effort: high, phased.** Auth underpins every gated surface; treat as a project,
not a task. Feasible incrementally (profiles table + phone first, cutover later).

---

## Part 3 — GDPR (Denmark/EU)

Framing: **Bella Nails is the data _controller_.** Clerk/Cal/Supabase/Zoho are
**processors**. Owning data in EU-hosted Supabase can *improve* posture (fewer
US transfers, one erasure surface) — but only if the controls below exist; it
also moves responsibility onto us.

**The essentials for a studio holding name/email/phone/appointments:**

1. **Legal basis (Art 6).** Bookings = **performance of a contract** (no consent
   needed for name/contact/appointment). Marketing email = **consent**
   (opt-in, withdrawable). Client photos = **consent** — already on the radar as
   [Task 08](../admin/08-photo-consent.md); nail photos likely aren't
   special-category, but a face makes them identifying.
2. **Processor agreements + transfers.** A signed **DPA** with each processor,
   and each hosted in the **EU** where possible: Supabase → pick an **EU
   region**; Cal → already `api.cal.eu`; Zoho → EU DC. **Clerk is US** → today
   that's a transfer needing SCCs/adequacy; retiring Clerk (Part 2) removes it.
3. **Transparency (Art 13).** A **specific** privacy notice at collection —
   Denmark enforces this strictly; generic notices are treated as
   non-compliance. Our booking form's `privacyNote` must name what's collected,
   why, the legal basis, retention, and processors.
4. **Data-subject rights.** Access, rectification, **erasure**, portability,
   objection. Need a real process to export **and delete** a client across
   Supabase + Cal + Zoho — erasure must **cascade to processors**, not just our
   row.
5. **Retention.** Define it. Tension: Danish **Bogføringsloven** requires
   accounting records ~5 years, but personal booking data beyond its purpose
   should be deleted/anonymised. Resolve by separating financial records
   (retain, minimised) from contact data (delete on schedule).
6. **Security (Art 32).** Encryption in transit/at rest, least-privilege access
   (RLS already helps), secret hygiene, backups, and a **breach process**:
   notify **Datatilsynet within 72 h** if there's risk, and log every breach
   regardless.
7. **Records of processing (Art 30).** A lightweight ROPA — likely not strictly
   mandatory at this scale, but cheap and expected.

**Danish specifics** (supplement GDPR via **Databeskyttelsesloven**):
Datatilsynet is the supervisory authority; child-consent age is **13** (relevant
only if minors book); **avoid CPR numbers** entirely (special handling); and
Denmark routes **fines through the criminal courts**. A **DPO is likely not
required** here (no large-scale special-category processing) — but document that
assessment.

---

---

## Detailed transfer plan (tentative — might do / might not do)

A phased path from "Clerk owns identity/PII (US)" to "we own it in EU-hosted
Supabase, compliantly." Each phase is **independently shippable and reversible**,
with a decision gate before the next — so we can stop at any phase if the value
isn't there. Nothing here is committed.

**Phase 0 — Groundwork & go/no-go (cheap, do first).**
- Inventory processors + sign missing **DPAs** (Clerk, Cal, Supabase, Zoho);
  confirm each is on an **EU region** (Supabase project region, Cal `api.cal.eu`,
  Zoho EU DC). Flag Clerk (US) as the transfer to retire.
- Confirm the Cal event type captures the phone (unblocks Option A's value too).
- Spike **Supabase Auth**: email OTP + the **owner-role** gate (custom claim or
  `profiles.role`), throwaway branch.
- *Gate:* is Supabase Auth sufficient and is ownership worth it? **Might not do:**
  if a Clerk paid plan is the cheaper compliance outsource, stop here and keep A.

**Phase 1 — Own the contact data (Option B).** *Might do.*
- Add a `profiles`/`contacts` store (or `attendee_phone`+`attendee_name` on
  `bookings`) written in `persistCalBooking` from the data already arriving there.
- One-time **backfill** from Cal for existing bookings.
- Admin reads phone from our DB; **retire Option A's Cal calls.**
- *Reversible:* drop the column/table, fall back to A. **Might not do:** if A's
  read-through is fine and we'd rather not hold PII yet, skip.

**Phase 2 — Supabase Auth in parallel (dual-run).** *Might do.*
- New sign-ins issue Supabase sessions; Clerk still valid for existing users.
- Map both identities to the same `profiles` row; keep `bookings.clerk_user_id`
  populated during the overlap.
- *Gate:* new-user flows solid (passwordless, Google/Apple, the Cal-webhook
  upsert)? **Might not do:** abort cleanly — Clerk still authoritative.

**Phase 3 — Migrate existing users.** *Might do.*
- Export Clerk users → import to Supabase Auth (verified emails preserved).
- Remap `bookings.clerk_user_id` → Supabase id (add `auth_user_id`, dual-write,
  then swap the FK). Reconcile races via email.
- *Reversible until the FK swap;* keep the Clerk export as rollback.

**Phase 4 — Cut over & remove Clerk.** *Might do — the point of no easy return.*
- Switch middleware/session/`currentUser()`/owner-role to Supabase; delete
  `@clerk/nextjs`. **Removes the US transfer.**
- *Gate:* full auth smoke test (sign-in, booking opt-in, admin gate, RLS).

**Phase 5 — GDPR controls (do alongside 1–4, not after).** *Must do if we hold PII.*
- Rewrite the booking **privacy notice** to be specific (data, purpose, basis,
  retention, processors) — Denmark enforces this strictly.
- Build **DSAR** export **and** erasure that **cascades** to Cal/Zoho, not just
  our rows.
- Automate **retention** (delete/anonymise contact data on schedule; keep
  bookkeeping records ~5 yrs per Bogføringsloven, minimised).
- Write a one-page **ROPA** and a **breach runbook** (Datatilsynet ≤72 h).
- *Might not do (defer):* full DSAR automation — an interim manual runbook is
  acceptable at low volume, but the erasure path must exist before cutover.

**Off-ramps in one line:** stop after Phase 0 (stay on Clerk) · stop after Phase 1
(own the phone, keep Clerk login) · full transfer (Phases 2–5).

## Questions the exploration must answer

1. Phone: ship **A (read-through)** now, or wait and do **B (store)** with Part 3
   controls? (Recommendation: A now, B as the migration's first brick.)
2. Is **Supabase Auth** sufficient for our flows (passwordless email, phone OTP,
   Google/Apple, owner role, the Cal-webhook upsert)? Prototype the owner gate.
3. Migration shape: big-bang cutover vs dual-run; how to move existing Clerk
   users without breaking `bookings.clerk_user_id`.
4. GDPR ownership: are we prepared to be the direct PII holder (erasure cascade,
   retention automation, DPAs, breach drills) — or is a Clerk paid plan the
   cheaper compliance outsource?
5. Which processors are on EU regions today, and which DPAs are unsigned?

## Non-goals

- Rebuilding auth speculatively — only if the phone/ownership/cost case holds.
- Collecting more PII than a booking needs (CPR, DOB, address — out).
- Legal sign-off in this doc; this is the engineering + compliance map, not
  advice. Danish counsel / Datatilsynet confirm the specifics.
