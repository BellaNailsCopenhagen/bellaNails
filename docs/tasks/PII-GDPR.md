# PII & GDPR — now that we hold the data

The Clerk→Supabase cutover **moved PII into our own database**: `clients`
(name, email, phone) + `auth.users` (email). Two consequences:

- ✅ **The US-transfer liability is gone** — Clerk (US processor holding EU PII)
  is retired. Remaining processors are EU: Supabase, Zoho (EU DC), Cal
  (`api.cal.eu`, until retired), Scaleway (EU).
- ⚠️ **We are now the direct holder** — the Part 3 controls in
  `explorations/auth-ownership-and-gdpr.md` are no longer "might do"; they
  **apply now**. This doc is the actionable version. *Not legal advice — confirm
  specifics with Danish counsel / [Datatilsynet](https://www.datatilsynet.dk).*

## The Datatilsynet question — do we "register"?
**No general registration.** Under GDPR the old pre-2018 notification-to-the-DPA
requirement was **abolished** — you do **not** register the business to process
ordinary booking data. What you actually owe Datatilsynet:
- **Breach notification ≤72 h** if a breach risks individuals → need a runbook +
  a named contact.
- **DPO registration** — *only if you must appoint a DPO*. At this scale (no
  large-scale special-category processing) a DPO is **likely not required** —
  but write down that assessment.

So there's nothing to "sign up" for now; the obligation is having the controls
below and being ready to notify on a breach.

## What we must have (controller obligations)

### 1a. Cookies — no banner needed (yet)
Only **strictly-necessary** (Supabase auth/session) + **functional** (next-intl
language) cookies are set — both exempt from consent under EU ePrivacy + the
Danish cookie rules. **No consent banner required.** Just list them + purposes in
the privacy notice (transparency). A banner becomes mandatory only if we add
**non-essential** cookies (analytics-with-cookies, ad/marketing pixels) — then a
proper opt-in CMP is needed (Datatilsynet enforces strictly). Vercel Web
Analytics is cookieless, so it wouldn't trigger one.

### 1. Specific privacy notice — do before launch
Denmark enforces specificity strictly; a generic notice is treated as
non-compliance. Update the booking-flow `privacyNote` + `/privacy` to state:
data collected (name, email, phone, appointments, photos), **purpose**, **legal
basis** (booking = *contract*; marketing email + photos = *consent*), **retention
periods**, **processors** (Supabase EU, Zoho EU, Cal until retired, Scaleway),
and **rights** + how to exercise them. Remove Clerk from the processor list.

### 2. Erasure (right to be forgotten) — do before launch
There is **no delete-a-client path today** (deferred at
`admin/clients/[id]/page.tsx`). **⚠️ A raw `DELETE FROM clients` is NOT erasure**
(audit-confirmed): the `client_id` FKs cascade `bookings`/`booking_requests`/
`client_media`/`media_consents`/`client_consents`/`terms_acceptances`/
`owner_notifications`, **but three things survive**:
- **`auth.users`** — the FK is `clients.auth_user_id → auth.users` (wrong
  direction), so the auth account (email + Google name/avatar in
  `raw_user_meta_data`, identities, sessions) persists. Needs a separate
  `supabase.auth.admin.deleteUser(auth_user_id)`.
- **Published photos stay live** — `media_consents.published_asset_id → assets`
  and `gallery_items.*_asset_id → assets` have no `on delete` rule, so the
  `assets` row, its `gallery_items` + `asset_usages`, and the **public Scaleway
  object** remain on the site after "erasure."
- **Scaleway objects** — DB cascade never touches object storage.

**Decision (owner, 2026-08-20): erasure = ANONYMIZE, not hard-delete.** Keep the
`clients.id` and everything linked to it (bookings, consents, communications), so
financial records survive (**Bogføringsloven ~5 yr**) and we retain proof of what
was agreed — and **scrub the identifiers** so the row no longer identifies a
person (a random-uuid id alone isn't personal data). ⚠️ So the cascading
`DELETE FROM clients` above is the WRONG approach — it would wipe the bookings we
must keep. Do this instead:

**Build `anonymizeClient(clientId)`** (owner-only, service-role):
1. **Remove the login** — `supabase.auth.admin.deleteUser(auth_user_id)` (drops
   the auth email + Google name/avatar); `clients.auth_user_id` → null.
2. **Scrub `clients`** — `name=null`, `phone=null`, `email` → a non-identifying
   placeholder like `redacted-<id>@anonymized.invalid` (email is UNIQUE + NOT
   NULL, so replace rather than null); set `anonymized_at=now()`.
3. **Keep** bookings, booking_requests, media/data consents, terms_acceptances,
   owner_notifications, communications — all stay linked to the retained id (the
   audit-trail / proof the owner wants).
4. Delete **only the client's OWN, unused uploads** — `client_media` with
   `source='client'` and no `published_asset_id` (not placed/used by the artist)
   — plus their **Scaleway private originals** (via `purgeMediaArtifacts`,
   `src/modules/media/erasure.ts`).

**Ownership is the line.** A client erasure removes everything the **client
owns** — their PII (scrubbed) and their own unused uploads (deleted). Everything
the **artist owns** — photos the artist captured for a session, and any
published / in-use asset (gallery / showcase / social), all linked to a booking —
**stays**. For those the client's only lever is **per-item consent withdrawal**,
which runs the existing **withdrawal → takedown** flow (and *does* take a
face-identifying photo down on a genuine request). The client can withdraw
consent for such items **individually — never delete them.** Account-deletion ≠
consent-withdrawal.

**GDPR honesty:** anonymization is a valid alternative to deletion *once the data
truly can't identify the person* — financial retention has a legal basis
(Bogføringsloven); nail-only photos aren't personal data (keep freely). The one
edge: a **face-identifying** published photo under a genuine erasure request must
still come down via the takedown flow — so keep that path working and document
the basis (consent for images, legal obligation for financials).

**Known limits of `anonymizeClient` (accepted / manual for now):**
- Consent rows for a **deleted unused upload** cascade away with it — proof is
  retained only for kept/published media (an "I declined" record for a photo the
  client is erasing has little value). Intentional.
- **`reviews.author_name`** has no `client_id` link, so a published testimonial
  carrying a real name isn't auto-scrubbed — the owner removes it via the
  testimonial/consent-withdrawal lever (manual). Consider linking reviews to a
  client later.
- **Cal.com** still holds attendee name/email/phone per booking; `anonymizeClient`
  doesn't reach Cal. Delete the Cal booking as a manual step until Cal is retired
  (then it cascades in-house).

### 3. Retention / auto-delete — the "auto-delete after X days"
Define a policy, then automate it (reuse the email system's **Supabase
`pg_cron`** infra). The key tension: Danish **Bogføringsloven** requires
**accounting records ~5 years**, but personal contact data beyond its purpose
must be deleted/anonymized. Resolve by **separating financial records (keep,
minimized) from contact PII (delete/anonymize on schedule)**:

- **Guest rows with NO bookings** (abandoned/spam sign-ups, no financial record)
  → the only case that may be **hard-deleted** after X days.
- **Unconfirmed `auth.users`** → delete after X days (Supabase doesn't auto-prune).
- **Any client WITH bookings** → **`anonymizeClient`** N years after their last
  appointment — never hard-deleted (keeps the anonymized booking + financial
  record for Bogføringsloven).
- **Expired consent tokens / stale rows** → delete.
- Make thresholds config; **log every run** (audit trail). Reuse the
  `anonymizeClient` routine so scheduled + manual erasure behave identically.

### 4. Processor DPAs + EU regions — verify now
PII is in our DB, so this matters immediately:
- **Supabase region = Frankfurt (EU)** ✅ — the PII we hold stays in the EU.
  (Region is fixed at project creation; make sure this is the *same* project the
  app points at — see the caveat below.)
- Zoho EU DC ✅ (already `smtp.zoho.eu` / `mx.zoho.eu`), Scaleway EU ✅, Cal
  `api.cal.eu` ✅ (until retired). **Sign a DPA** with each.

### 5. Security (Art 32) — mostly in place, document it
RLS (have), service-role key hygiene, encryption at rest (Supabase default),
backups, least-privilege. Write the one-paragraph summary + the breach runbook
(who/how/Datatilsynet ≤72 h/log-every-breach).

### 6. Consent records + marketing opt-in
We already log photo/data consent (`media_consents`, `client_consents`,
`terms_acceptances`) — that's the evidence GDPR wants. For **marketing email**
add an explicit **opt-in flag** + a working **unsubscribe** (ties into the email
system). Booking/consent emails are transactional (contract basis), not marketing.

### 7. ROPA (records of processing) — one-pager
Likely not strictly mandatory at this scale, but cheap and expected. List
processing activities, data, basis, retention, processors.

## Also
- **Minors**: DK child-consent age is 13 — relevant only if minors book (probably
  N/A; note it).
- **Never collect CPR** (Danish personal ID) or DOB/address — out of scope, and
  CPR triggers special handling. We don't; keep it that way.

## Priority
- **P1 (launch-blocking, since we now hold PII):** specific privacy notice ·
  erasure cascade action (incl. Scaleway) · confirm Supabase EU region + sign DPAs.
- **P2:** retention auto-delete cron (guest cleanup + anonymize-after-N-years,
  financial-minimized) · DSAR export.
- **P3:** ROPA + breach runbook (docs) · marketing opt-in + unsubscribe (with the
  email system).
