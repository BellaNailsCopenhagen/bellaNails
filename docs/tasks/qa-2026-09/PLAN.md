# QA pass — remediation plan (7 Sep 2026)

Findings from a full software + UX test pass over the live local build, driven as a
signed-out visitor, as a client, and as the owner. Full report:
<https://claude.ai/code/artifact/95ef6f3d-e71d-4dea-bbc1-064f55b66078>

**This file is the work list.** Everything in it is fixable in this codebase. Things
that need an account, a secret, a legal decision or a piece of real content are in
[§ Not in this plan](#not-in-this-plan--yours) at the bottom — the plan links to them
where a code fix only closes half the gap.

Work it with [PROMPT.md](PROMPT.md): one item at a time, fix → review → merge.
Tick the box when the item is merged to `main`.

Evidence key: **[live]** reproduced in the browser this session · **[code]** found by
reading the source, not triggered.

---

## Batch A — blocks a first real client

- [x] ### QA-01 · Sign-in hangs on "Verifying…" when there is no `next` **[live]**

  The header "Log ind" link is `/da/login` with no `?next=`. A correct code creates the
  session, but the form never navigates: the button sits on `VERIFYING…` indefinitely and
  the user has no way to know they are signed in. Reproduced twice — once with no `next`,
  once with `?next=//evil.example.com/` (rejected by the guard, which is correct).
  With a valid `next` the round trip is perfect, so the failure is in the fallback path.

  - `src/components/auth/supabase-login-form.tsx` — `verify()` ends in
    `window.location.assign(next)`; `next` defaults to `"/"`, and `safeInternalPath()`
    also returns `"/"` for anything unsafe. Establish whether the assign is not reached
    or not resolving, and make the fallback land somewhere real (`/${locale}` rather
    than `/`, which then has to re-negotiate the locale).
  - Do the same for `google()`, which shares the `next` contract.
  - **Verify:** `/da/login` with no query → code → lands on the Danish home, signed in.
    `?next=//evil.example.com/` → lands on the Danish home, still on our origin.
    `?next=/da/book?service=…&step=details` → returns to that exact step (already works;
    don't regress it).

- [x] ### QA-02 · The DK / EN toggle drops the query string **[live]**

  Mid-checkout, switching language throws the visitor back to the service picker: the
  chosen service, add-ons, step, name and phone all disappear. Same loss on
  `/confirmation?id=…` (the recap vanishes) and `/appointments?tab=…`.

  - `src/components/layout/locale-toggle.tsx` — next-intl's `usePathname()` is
    pathname-only. Append `useSearchParams()`.
  - **Verify:** on `/da/book?service=…&step=details&addons=…`, the EN link carries the
    same query; switching keeps the summary and the step. Repeat on `/confirmation?id=`
    and `/appointments?tab=permissions`.

- [x] ### QA-03 · A blank `/confirmation` tells anyone their session is reserved **[live]**

  `/da/confirmation` with no `?id` renders the full success state — *"Din session er
  reserveret … En bekræftelse er på vej til din e-mail."* Nothing was booked. A stale
  bookmark or a back-button return produces a confident false confirmation.

  - `src/app/[locale]/confirmation/_components/confirmation.tsx` — the `id === null`
    branch. Keep the calm tone, change the claim: we can't find that booking, here is
    the menu and My Space.
  - New i18n keys in both catalogues.
  - **Verify:** `/da/confirmation` and `/en/confirmation` say nothing is reserved;
    `?id=<real>` is unchanged.

- [x] ### QA-04 · A decided request keeps a permanent "needs you" notification **[live]**

  Accepting a booking request clears it from the queue but leaves the notification in
  `NEEDS YOU`, deep-linking to `/admin?focus=request-<id>` where nothing renders. The
  badge count never returns to zero, so it stops meaning anything.

  - `src/modules/booking/request-actions.ts` — `acceptBookingRequest` and
    `rejectBookingRequest` should dismiss the `booking_request` notification whose
    `target_id` is that request. Best-effort, like `recordCommunication`: log a failure,
    never fail the action for it.
  - Check the same class of leak for `design_request` and the consent kinds while you
    are in there, and note (don't fix) any others found.
  - **Verify:** raise a request → badge +1 → accept it → badge back down, nothing left
    in `NEEDS YOU`. Then reject one and confirm the same.

---

## Batch B — make the admin tell the truth about its own config

Both of these are half a fix: the value belongs in the environment (see § Not in this
plan). The code half is that a control which cannot work must not look like one that can.

- [x] ### QA-05 · Bot protection reads as ON while it is not running **[live]**

  `HUMAN_CHECK_SECRET` is unset, so `humanCheckConfigured()` is false: the box never
  renders **and** `createBooking` skips the proof. The App-settings toggle stays ticked.
  The screen tells the artist she is protected when she is not.

  - `src/app/admin/settings/_components/booking-protection.tsx` — when the check is not
    configured, show it as unavailable with a one-line reason, the way the card option
    already does with its NOT AVAILABLE YET badge. Do not silently untick her choice.
  - Surface the same fact wherever the access-level copy promises protection.
  - The server already fails safe by skipping; leave that, but log once at boot so a
    misconfigured deploy is visible in the logs rather than only in the UI.
  - **Verify:** with the secret unset, App settings says so; with it set, the box renders
    at step 03 and a booking without a solved proof is refused.

- [x] ### QA-06 · "Request review" is a live-looking button that always errors **[live]**

  `GOOGLE_REVIEW_URL` is unset → every press returns *"Review link isn't set up yet."*
  The button is identical to the ones that work, on every completed appointment card.

  - `src/components/admin/queue-booking-card.tsx` — hide or disable-with-reason when the
    link is not configured, same pattern as QA-05.
  - `src/modules/booking/review-actions.ts` — while here, move the hardcoded DA/EN email
    copy out of the action and into `src/modules/notifications/*-email.ts` like every
    other send, and re-check `canRequestReview` server-side (the 30-minutes-before-end
    rule is currently UI-only). Same for `requestMediaRelease` vs `canRequestMediaConsent`.
  - **Verify:** unset → no live button. Set → the email sends and a
    `review_request · manual` row appears in the client's communications log.

---

## Batch C — data-safety bugs

- [x] ### QA-07 · A failed read on `/admin/business` turns Save into a wipe **[code]**

  `getBusinessProfileForAdmin` catches any error and returns a blank profile, and the
  page has no error state — a transient read failure renders a form indistinguishable
  from "nothing configured yet". Touch one field, press Save, and `saveBusinessProfile`
  maps every empty string to `null`: address, all three email addresses and all three
  social links go in one upsert. Highest-consequence bug on that page.

  - `src/modules/business/profile.ts` — return a `loadError` flag instead of swallowing.
  - `src/app/admin/business/page.tsx` — render `ErrorState` on it, the way
    `/admin/services` already does, keeping the header intact.
  - **Verify:** point the read at a bad table name locally → the page shows an error and
    offers no Save, rather than an empty form.

- [x] ### QA-08 · Publishing empty terms replaces the live public document **[code]**

  `saveTermsVersion` does `trim() || null` with no validation. An accidental Publish on
  an empty editor creates a new *current* version with all-NULL text, which is
  immediately what `/terms` and `/privacy` serve. There is no preview and no rollback —
  the version badges are decorative.

  - `src/modules/terms/actions.ts` — require a non-empty title and body in both locales
    (or state deliberately which are optional) and refuse otherwise.
  - `src/app/admin/terms/_components/terms-editor.tsx` — disable Publish until valid,
    matching the note dialog and reviews manager.
  - Worth doing in the same pass: let a past version be viewed. Rollback can wait, but
    an immutable history nobody can read is not a history.
  - **Verify:** empty editor → Publish is disabled; a whitespace-only body is refused
    server-side too.

- [x] ### QA-09 · An empty price field silently creates a 0 DKK service **[code]**

  `Number("")` is `0` and `krToCents` accepts it, so only literal gibberish is rejected.
  A 0 kr service goes straight onto the public menu and into the booking flow.

  - `src/app/admin/services/_components/create-service-sheet.tsx` and
    `edit-service-sheet.tsx` — treat empty as missing, not as zero.
  - `src/modules/catalog/validation.ts` — reject a non-positive price at the server too,
    so the fix holds for any caller. Decide explicitly whether a free service is ever
    legitimate; if it is, make it a deliberate choice rather than an empty field.
  - **Verify:** blank price → a clear field error, no row written.

- [x] ### QA-10 · Rejecting a request emails the client even when the write failed **[code]**

  `rejectBookingRequest` discards the result of `updateBookingRequest` and returns
  `{ok:true}` regardless. If the flip fails, the client is told no while the request sits
  in the queue looking undecided.

  - `src/modules/booking/request-actions.ts` — check the result, return the failure, and
    only send the decline email once the status is actually stored.
  - **Verify:** force the update to fail → no email, an honest error, request still pending.

- [x] ### QA-11 · Accepting a request can book into the past **[code]**

  `acceptBookingRequest` validates only `Number.isFinite(startMs)` — no past check, no
  upper bound, no availability check. A stale "Adjust time" sheet left open overnight can
  create a booking in the past; only the overlap constraint stands in the way. The create
  path guards this properly and is the model to copy.

  - `src/modules/booking/request-actions.ts` — reject a start in the past and beyond the
    booking horizon.
  - While here: `updateBookingRequestTime` in the same file is a live `"use server"`
    action with **no callers anywhere**. Delete it rather than leave a remote-callable
    surface nothing exercises.
  - **Verify:** hand-post a past `startIso` → refused with a clear message.

---

## Batch D — the SEO surface

- [x] ### QA-12 · No sitemap, robots, canonical, hreflang or LocalBusiness schema **[live]**

  `/sitemap.xml` and `/robots.txt` both 404. The rendered head of `/da` has no canonical,
  no `hreflang` alternates and no JSON-LD. Titles, descriptions and OG images *are*
  properly localised and keyworded — the copy work is done; the machine-readable half is
  missing, and the two locales currently look like duplicate content.

  This is Phase 10 and `docs/seo-plan.md` already scopes it. It blocks the studio's whole
  acquisition plan, so it is not a "later" item — but it is the one piece of work here
  that partly waits on the final domain and the public phone number.

  - `src/app/sitemap.ts` — both locales, real routes only; exclude `/admin`, `/book`
    steps, `/confirmation`, and every token route.
  - `src/app/robots.ts` — allow the public site, disallow `/admin` and the token routes,
    point at the sitemap.
  - `alternates: { canonical, languages }` in each public page's metadata, driven off
    `NEXT_PUBLIC_SITE_URL`.
  - `NailSalon` / `LocalBusiness` JSON-LD built from `business_profile` + `schedule_rules`
    so opening hours in the markup can never drift from the ones on the page.
  - **Verify:** both files return 200 with the right hosts; `/da` and `/en` each carry a
    self-canonical and point at each other; the JSON-LD validates and its `openingHours`
    match the footer.

---

## Batch E — language and copy

- [x] ### QA-13 · The login page is entirely English on a Danish-default site **[live]**

  Tab title "Log in", then "Continue with Google or your email", "CONTINUE WITH GOOGLE",
  "EMAIL ME A CODE", "I already have a code" — inside a Danish header and footer, on the
  one screen standing between a Danish client and a booking.

  - `src/components/auth/supabase-login-form.tsx` and the `/[locale]/login` metadata —
    move every string into the catalogues.
  - Two more leaks in the same sweep: `src/components/auth/sign-out-button.tsx` (kept
    locale-free for the admin shell — give it a prop rather than hardcoded English), and
    the permissions-tab error state *"We couldn't load your choices"*.
  - Sweep the client-facing server-action error strings while you are here; the ones a
    client actually hits in the booking flow are already Danish, so this is about the
    long tail.
  - **Verify:** `/da/login` is entirely Danish including the tab title; `/en/login`
    unchanged; both catalogues still have equal key counts.

- [x] ### QA-14 · The code is eight digits and every screen says six **[live]**

  Four codes arrived this session, all 8 digits. The login screen says "Enter the 6-digit
  code", the placeholder is `123456`, and App settings promises clients "a 6-digit code".
  The field has no maxlength so it works, but the copy invites people to think they were
  sent the wrong thing.

  - Either set Supabase's OTP length to 6 (Auth → Providers → Email), or change the three
    strings. Pick one and make all three agree.
  - **Verify:** what the email sends and what the screen asks for are the same number.

- [x] ### QA-15 · One client, one conversation, two languages **[live]**

  The request acknowledgement came in Danish (sent from the `/da` flow); the confirmation
  for that same request arrived in English, because accept uses the client's stored
  `communication_locale` while the request path uses the browsing locale.

  - Pick one source of truth. Suggestion: the stored `communication_locale` wins when
    set, and the browsing locale seeds it on first contact — then a client who books in
    Danish is Danish from then on.
  - Related and smaller: the request email greeted *"Hej QA"* using the name typed at
    step 02, while the admin card and the confirmation used the stored client name. The
    name a client types at checkout currently goes nowhere. Decide whether it updates the
    client record or is ignored — but not both.
  - **Verify:** one client, one request, accept it: both emails in the same language, both
    using the same name.

---

## Batch F — hardening and tidy

- [x] ### QA-16 · Add-on incompatibility is enforced in the UI only **[code]**

  The customiser disables clashing pairs and the page re-sanitises a hand-edited
  `?addons=`, but `prepareBooking` sums the add-ons without ever consulting
  `incompatiblePairs`. Any non-UI caller can persist a combination the studio can't perform.

  - `src/modules/booking/*` — validate the set in `prepareBooking` and return a clear
    refusal.
  - **Verify:** post two incompatible add-on ids directly → refused.

- [x] ### QA-17 · A booking request can name any time at all **[code]**

  `createBookingRequest` runs with `checkSlot: false` and never verifies that an
  `outside_hours` request is actually outside hours, or that an `over_limit` one is
  actually over the limit. The only time guard is "future, within 366 days", and there is
  no per-client cap beyond the 5/hour rate limit — so one person can queue five
  conflicting requests an hour, each costing an alert and two emails.

  - Validate the stated reason against reality, and cap concurrent pending requests per
    client.
  - Manual approval is the backstop, which is why this is hardening and not a blocker.
  - **Verify:** an `outside_hours` request for 11:00 on a Saturday is refused.

- [x] ### QA-18 · Nine admin page-reads bypass RLS with no owner check **[code]**

  Every one of the 60+ admin *mutations* calls `requireOwner()` — that audit came back
  clean. Several page-backing reads build a service-role client and rely entirely on
  `proxy.ts`, against the doctrine written into `require-owner.ts` itself. The sharpest is
  `media/asset-hub.ts` `getHubAssets`: every client's private photos, with freshly signed
  URLs. Not remote-callable today; the exposure arrives the day one of them is put behind
  an action or a route handler.

  - Add `requireOwner()` to: `media/asset-hub.ts` (`getHubAssets`, `getHubAppointments`),
    `notifications/reads.ts` (`getUnreadNotificationCount`, `getNotifications`),
    `notifications/communications.ts` (`getClientCommunications`),
    `studio/insights.ts` (`getStudioInsights`), `catalog/admin-catalog.ts`,
    `media/gallery-preview.ts` (`getStudioGalleryItems`), `booking/admin-view.ts`.
  - `booking/reads.ts` `getBookingForManageAsOwner` is shared with the token-validated
    public manage page — split it rather than gating it wrongly.
  - Two runtime-unvalidated string params on owner-only actions in the same sweep:
    `setFeatureFlag(key)` (`studio/actions.ts`) and `requestDataConsent(purpose)`
    (`media/owner-media-actions.ts`) — both TypeScript-only unions, erased at runtime.
  - **Verify:** every admin page still renders as owner; lint and build clean.

- [x] ### QA-19 · The hours editor has no hour axis **[live]**

  "Tap a day to add hours" — but the day grid is an unlabelled box with four faint
  dividers and no times down the side. On a closed day it is an empty rectangle with a
  dash in it. This is the screen that decides every bookable slot.

  - `src/app/admin/hours/_components/*` — hour labels down the edge, a visible "now" line
    on today, and a legible empty state for a closed day.
  - **Verify:** tapping a position adds a block at the time the axis says it will.

- [ ] ### QA-20 · Small UX and dead code **[live + code]**

  - **Cancel dialog doesn't name the appointment.** *"test's appointment will be
    cancelled"* — with three bookings for one client on screen, that is a coin flip. Put
    the date, time and service in the dialog.
  - **A signed-in visitor to `/login` gets the full login form** — no "you're already
    signed in", no redirect.
  - **"Messages" in the admin More menu links to `/admin`**, not to a messages page. The
    badge count is right; the destination is a promise the app doesn't keep. Either build
    the page or relabel and point it at the Today section.
  - **`src/config/features.ts` is dead code.** Six flags, and `feature()` is called
    nowhere. Flipping `testimonials: false` changes nothing. The live system is the DB one,
    which has exactly one flag. Delete the dead one before someone trusts it.
  - **`more/page.tsx`** also carries `soon` and `external` branches no `ITEMS` entry uses,
    and an `href` fallback of `"#"`. Remove.
  - **Env tidy.** `ZOHO_SMTP_USER` is followed by a long run of spaces and an inline `#`
    comment on the same line, and `NEXT_PUBLIC_SITE_URL` is declared twice in
    `.env.local`. Email works, so the parser is coping — but it is a trap. Fix both files
    and `.env.example`.
  - **Verify:** each of the six, by hand.

---

## Decisions to make, then build (not yet actionable)

These are real, and none of them has an obviously correct answer. Answer them, then they
become work items.

- **Root locale.** `/` resolved to `/en` for an English-language browser. That is
  Accept-Language negotiation working as designed. On a Danish-first business you may want
  `/` to always be `/da`.
- **Future appointments in the permissions list.** My Space shows the 13 Sep booking —
  which hasn't happened — with all three purposes already *Delt* and "no photos yet".
  Should a session that hasn't occurred be there at all?
- **A cancelled future booking files under History** in My Space, above August entries.
  Correct by status, confusing by date.
- **Admin stays English-only**, by design (`config/admin.ts`). Confirm.
- **The card-on-file radio** is a permanently disabled NOT AVAILABLE YET control. Keep it
  visible as a signpost, or hide it until Stripe lands?
- **Service detail pages** add nothing to the menu row — no sections, no gallery, no
  reviews on any service. Fill them or drop the "læs mere" link.

---

## Not in this plan — yours

Nothing below can be fixed by editing this repo. Several of them are the other half of an
item above.

**Accounts and secrets**
- Google OAuth provider in Supabase + the redirect URI in Google Cloud. Untested this pass.
- `HUMAN_CHECK_SECRET` — the other half of QA-05. Until it is set, bot protection is off.
- `GOOGLE_REVIEW_URL` — the other half of QA-06.
- Confirm `supabase/rate-limits.sql` is applied. It fails open and logs nothing a user
  sees, so "working" and "silently disabled" look identical. Check the server log for
  `[rate-limit] check failed, allowing:`. If it is missing, the booking rate limit does
  nothing **and** a solved human-check proof becomes replayable, since single-use is
  implemented as a rate-limit token.
- Do **not** apply `supabase/outside-hours.sql` — it targets the retired `studio_hours`
  table and will error. Outside hours moved to `schedule_rules`.
- `supabase/gallery-surface-cleanup.sql` is cheap and still pending.

**Content and data**
- Real terms and privacy text. Both documents currently open by telling the reader they
  are drafts, and clients are recorded as accepting them at step 03. Publish v2 from
  `/admin/terms`; old acceptances keep pointing at the text they agreed to.
- Remove the cartoon illustration published as client work on `/gallery`
  (`/admin/assets` → *test · Classic Manicure, 30 Aug* → remove the placement, then
  confirm takedown so the public copy is deleted).
- Studio gallery is empty — `gallery_items` has 0 rows, so a main-nav page renders a
  heading over blank space and the home page drops the section entirely.
- Confirm the opening hours: Mon–Fri closed, Sat–Sun 10:00–18:00. Everything downstream
  follows from this.
- Resolve the duplicate services: *Klassisk Manicure* 350 vs *Den Klassiske Manicure* 320,
  and *Gel Lak* 450 vs *Shellac / BIAB* 420 — same category, same duration, both live.
- Social URLs in `/admin/business` — all three blank, so the footer shows none.
- Two clients called Raul (2 bookings and 3 bookings, separate emails).

---

## Test data left behind by the pass

- `booking_requests` row `e241edbb-c136-4078-833c-7da2071df28e`, status *accepted*.
- One booking, Sat 12 Sep 10:00, Classic Gel Extension + Stones — already cancelled, so
  inert but visible in history.
- Four emails in `home@bellanails.dk`; three OTP sign-ins as `veronica.a@`.

---

## Found while fixing

Scope-adjacent things noticed while working an item. Not fixed there; not yet
work items either.

- **QA-01 · `/api/auth/callback` reports OAuth failure to nobody.** The failure
  path redirects to `/login?error=auth`, but `login/page.tsx` reads only `next`,
  `redirect_url` and `email`. A visitor whose Google sign-in failed gets a blank
  login form with no explanation. Needs a string in both catalogues, so it
  belongs with QA-13.
- **QA-01 · the redirect is locale-less.** That same failure redirect targets
  `/login`, which the proxy then locale-negotiates — so a Danish visitor whose
  OAuth failed can land on `/en/login`. Same class as QA-01, different caller.
- **QA-04 · the same leak exists for every other alert kind.** Nine `notifyOwner`
  calls, no automatic dismissal anywhere — the only clearing is manual (open it,
  ×, clear-read, mark-all-read). The ones with an in-app resolution point, so the
  same fix applies: `design_request` and `design_reply` (resolved by replying or
  sending an offer), `testimonial_submitted` (resolved by approving), and
  `media_consent_offered` (resolved by placing the asset). One line each with
  `dismissOwnerNotifications`, now that it exists.
- **QA-04 · the consent kinds can't be dismissed by target at all.** Every
  `media_consent_*` row in the live inbox has `target_id` NULL, so there is
  nothing to match on. They are informational rather than to-dos, so being
  read is arguably the right end state — but four unread `media_consent_restored`
  and one `media_consent_offered` are sitting in the badge count today.
- **QA-04 · one stale alert predates the fix.** The accepted request
  `e241edbb-c136-4078-833c-7da2071df28e` still holds an unread `booking_request`
  notification (`6948dd85-0858-4e0c-b02b-d254c2ea8130`). The fix is not
  retroactive; clear it with the × in /admin/notifications.
- **QA-05 · `src/instrumentation.ts` is now the place to say what is dark.** It
  warns once per server start about `HUMAN_CHECK_SECRET`. Every other
  env-guarded integration degrades just as quietly (`GOOGLE_REVIEW_URL`,
  the manage-token secret, SMTP) and each is one line here.
- **QA-06 · `GOOGLE_REVIEW_URL` is in no `.env.example`.** The one thing that
  would have told anyone the variable exists. Belongs with QA-20's env tidy.
- **QA-06 · `src/components/admin/deployment-capabilities.tsx` is the place for
  the next one of these.** A context read once in the admin layout, defaults all
  false. QA-05's human-check availability is still threaded as a prop because it
  had one render site; if a second appears, move it here.
- **QA-07 · this item's own Verify step does not test the fix.** "Point the read
  at a bad table name" returns PostgREST `PGRST205`, which the pre-existing
  `isMissingTable()` classes as "not migrated". Measured against the live
  project: a bad *table* gives `PGRST205`, a bad *column* gives `42703`. So the
  recipe exercises the benign branch. To see the error state, break a column
  name, not the table.
- **QA-07 · `getBusinessProfile()` (the public read) still swallows.** That is
  correct — the footer and the email senders must degrade to the compiled
  defaults rather than fail a page. The asymmetry is deliberate: that read only
  displays, this one backs a form that writes.
- **QA-08 · both live documents still open by calling themselves drafts.** v1 of
  `service` and `data` are the seeded placeholders (verified on the live
  project — /da/terms reads "Disse betingelser er et udkast"), and clients are
  recorded as accepting them at step 03. Both pass the new publish rule
  comfortably, so replacing them is now just a matter of writing v2. Already in
  § Not in this plan, and still yours.
- **QA-08 · rollback is still not possible.** A past version can now be read but
  not restored. Making an old version current again is a one-line reuse of
  `setTermsCurrent` — deliberately not done here, because "which version were
  they shown" needs thinking about before history can move.
- **QA-09 · the design offer has a worse version of the same bug.**
  `design-request-card.tsx:312` does `Math.round(Number(priceInput) * 100)`. As
  well as the empty-is-zero trap, `Number("1.200")` is 1.2 — so a 1.200 kr offer
  typed the Danish way is sent to the client as **1,20 kr**. That is precisely
  the bug `parseKroner` was written to fix, and this is the one caller still not
  using it. Not touched here: a design offer is a different flow with its own
  semantics, and it deserves its own item. It is the sharpest thing on this list.
- **QA-12 · all of this is only as right as `NEXT_PUBLIC_SITE_URL`.** Every
  canonical, every hreflang, the sitemap and the robots `Sitemap:` line are
  built from it. It is `http://localhost:3000` in `.env.local` and
  `https://bellanails.dk` in `.env.example`, so the production value has to be
  the live domain before any of it means anything — and per
  [[domain-not-on-vercel]] the domain still points at the old host. Nothing to
  submit to Search Console until then.
- **QA-12 · the schema still owes a phone number and geo coordinates.** Both are
  open items in `docs/seo-plan.md` §7 and both are omitted rather than guessed —
  Google displays a telephone from structured data, so a placeholder would be
  worse than none. `areaServed` and the address are live.
- **QA-12 · `/gallery` is in the sitemap but has no content.** `gallery_items`
  has 0 rows, so it is currently a heading over blank space being offered to a
  crawler. It is a permanent main-nav page so it belongs in the sitemap; the
  emptiness is the content item already in § Not in this plan.
- **QA-13 · it settled half of QA-14 by hand.** The new login copy states no
  digit count at all (`codeSentTo` is "Enter the code sent to {email}") and the
  placeholder is `12345678`, matching what Supabase actually sends. So QA-14 is
  now only the App-settings line promising clients "a 6-digit code" — plus
  Raul's decision on whether to shorten the OTP instead.
- **QA-13 · `useActionRunner` prefers the action's message over the caller's
  localized fallback.** `toast.error(result.error || fallbackError)` — which is
  right (a specific reason beats a generic one) but means any English string an
  action returns wins over translated copy. That is why this leak existed. The
  five client-facing actions are fixed; the ~45 remaining English strings are
  all in owner-only actions, where English is the design.
- **QA-13 · the release actions were toasting raw codes at clients.**
  `preApproveRelease` and friends answer with `"not_found"`, `"invalid_link"`,
  `"already_decided"` — a good contract, but nothing translated them, so a
  failure put the code itself in a toast. Now mapped through
  `releaseErrorCopy()` at all three client surfaces.
- **QA-14 · resolved by removing the number, not by matching it.** All three
  places now describe "a code" with no digit count, and the login placeholder is
  eight digits because that is what Supabase currently sends. If you would
  rather have six, Auth → Providers → Email is still yours to change — and the
  copy will stay correct either way, which was the point of taking the number
  out rather than changing 6 to 8. The OTP input still has no `maxLength`, on
  purpose: a cap would break the day the setting changes.
- **QA-15 · the plan's suggested locale rule is not implementable as written.**
  "The stored `communication_locale` wins when set, and the browsing locale
  seeds it on first contact" needs "not set" to exist, and
  `supabase/client-locale.sql` declares the column `text not null default 'da'`
  — so a client who has never expressed a preference is indistinguishable from
  one who chose Danish. The rule shipped instead is the one `createBooking`
  already used: **a client-initiated action stamps the browsing locale, and
  every email reads the stored value.** Same outcome for the reported bug, no
  migration, and the two paths now agree instead of being a third rule.
  If you want the artist's manual override in `/admin/clients/[id]` to survive
  a client booking in the other language, that needs the column nullable — say
  so and it is a small migration plus one condition.
- **QA-15 · the name question was already answered in the code.**
  `ensureUser` documents "name is filled-if-empty (a booking typo never
  clobbers a client's chosen display name)", which is the right rule — so the
  typed name is *ignored* for the record, and the fix was to stop the ack email
  greeting with it. It now uses the stored name like the admin card and the
  confirmation do. For a brand-new client the stored name IS the one they
  typed, so there is one code path, not two.
- **QA-16 was already false when it was written — no fix was needed.** The item
  says "`prepareBooking` sums the add-ons without ever consulting
  `incompatiblePairs`". There is no `prepareBooking` anywhere in the repo; the
  function is `buildBookingDraft`, and it has consulted them since 946263b
  (29 Aug, nine days before the pass). `booking-draft.ts:52-69` calls
  `listIncompatiblePairsAmong` and refuses on a clash — and refuses on a read
  error too, so it fails closed either way. Every path that inserts a booking
  goes through it, except accept, which builds from a request snapshot that was
  itself validated there at creation.

  So the rule is enforced in **three** places, not one: the customizer's
  checkbox locking, `sanitizeSelectedAddonIds` for a hand-edited `?addons=`,
  and the persist-time refusal. Verified against the live project: the two
  configured pairs (Extra Massage × Nail Art, Colour × Extra Massage) make the
  guard's own query return a clash, and a compatible pair returns none.

  What WAS missing is a test — `sanitizeSelectedAddonIds` is a pure rule with
  none, so this item shipped six instead of a redundant guard.
- **QA-17 · `MAX_ACTIVE_BOOKINGS` was declared twice in effect.** The cap of 2
  lived as a private constant in `create-booking-actions.ts`, so the request
  path had no way to check the limit it exists to overflow. Both now read
  `MAX_ACTIVE_BOOKINGS` from `shared/booking-policy.ts`.
- **QA-17 · the reason checks fail OPEN, deliberately.** A schedule or count
  read that errors lets the request through rather than refusing a client who
  genuinely cannot self-serve — matching how `createBooking` treats its own
  cap check. Manual approval is the backstop, which is what makes that the right
  way round; the tests pin the empty-schedule case explicitly.
- **QA-17 · there is still no "the slot is taken" reason.** A client who picks a
  time inside standard hours that is already booked now gets "book it in the
  usual way", and the booking flow will tell them it is taken. That is correct
  but slightly circular. A third kind (`slot_taken`) would let them ask for a
  time the studio might squeeze in — a product decision, not a bug.
- **QA-18 · `requestDataConsent`'s purpose set already had a narrowing
  predicate.** `shared/data-consent.ts` exports `isDataConsentPurpose`, and the
  action had hand-written the same union inline instead of using it — so the
  registry and the action could drift as well as the value being unchecked.
  Now it asks the registry.
- **QA-18 · eleven more module files build a service-role client without a
  gate, and most of them should.** `ensure-user`, `availability`,
  `identity/server`, `clients/contacts`, `release-actions`, `release-reads`
  (token-validated, same class as the new `getBookingForSignedToken`),
  `data-export-actions` (the client's own, gated by session) and the rest are
  public or client-authenticated paths by design. They were not in this item's
  list and each needs its own judgement, so none was touched. Worth a pass of
  its own before anyone assumes "service-role" means "admin".
- **QA-18 · `studio/conflicts.ts` defaults its client to service-role.**
  `getScheduleSnapshot(db = createSupabaseServiceRoleClient())` — every real
  caller passes a `requireOwner()` client, so it is gated in practice, but the
  default is a gate-bypass waiting for a caller who forgets. Making the
  parameter required would close it.
- **QA-19 · today's column was already a few pixels out of line.** The round
  date pill on today is 24px tall against ~20px for the plain dates beside it,
  so today's grid body started lower than its neighbours'. Invisible while
  there was no axis; fatal once there is one, so every day header now has a
  fixed height.
- **QA-19 · self-review caught the now-line being silently absent.** The first
  version computed minutes-into-the-day with `dayNumberToMs`, which anchors at
  **midday UTC** — it produced −225 for a 10:15 studio morning, which reads as
  "off the axis" and drew nothing at all rather than drawing something wrong.
  It uses `studioWallTimeToInstant(day, "00:00")` now, which is DST-correct.
  Verified numerically against the real helper: 10:15 local → 26.6% down.
