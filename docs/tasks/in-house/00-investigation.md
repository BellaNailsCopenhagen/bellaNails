# In-house scheduling & identity — investigation brief

> Owner of this doc: whoever picks up [Phase 11](../../PLAN.md#phase-11--in-house-scheduling--identity-retire-calcom--clerk).
> **This is not a build brief.** It is the list of things that must be answered *with code or a
> vendor doc in hand* before any of Phase 11's five steps gets an implementation task.
>
> Rule for this document: every answer lands back in `PLAN.md` as a **decision with a date**,
> or as a **⚠️ blocker**. An unanswered question is not permission to guess.

## Why an investigation phase at all

Phase 11 removes two vendors that between them own 292 references across ~70 files, six tables'
worth of foreign keys, every user-scoped RLS policy, and the artist's only working calendar. The
migration order is already decided and each step is revertible — but three things are currently
**assumptions**, and if any is wrong the order or the scope changes:

1. That the slowness the owner feels is *not* Cal/Clerk (if it is, sequencing changes).
2. That Supabase Auth can replace Clerk's role in this app without new gaps.
3. That we can generate slots that match today's behaviour closely enough to cut over safely.

Everything below exists to convert those three into facts.

---

## Spike 1 — Perf baseline (do first, ~half a day)

**Question:** where does the intermittent slowness actually come from?

This blocks nothing, but it must happen *before* the migration, or we lose the ability to tell
whether the re-platform helped. It is also the honest test of the owner's stated motivation.

- [ ] Record LCP / TTFB / transferred bytes for `/da`, `/da/services`, `/da/gallery`, `/da/book`
      on the **deployed** host (not local), cold and warm, mobile throttled.
- [ ] Break down: HTML TTFB (server) vs. media bytes vs. third-party JS (Cal embed, Clerk).
- [ ] Measure gallery media specifically — object sizes actually served from
      `s3.fr-par`, and whether anything is cached at the edge.
- [ ] Check Supabase query timings for the RSC reads on those routes (Phase 3 deferred indices —
      confirm whether that's now biting).

**Expected finding**, stated up front so we notice if we're wrong: media dominates, Cal's iframe
is second and confined to `/book`, Clerk is a distant third. **If Clerk/Cal turn out to dominate,
say so and re-sequence** — that would justify moving faster and worrying less about polish.

**Deliverable:** a short table in this file + a decision on whether CDN / image-variant work
becomes its own task ahead of Phase 11 (it probably should — it's cheaper than everything else
here and helps regardless).

---

## Spike 2 — Supabase Auth capability check (~1 day)

**Question:** does Supabase Auth cover everything Clerk currently does for us, and what does it
*not* cover?

Read the current usage first — `src/lib/clerk/`, `src/lib/admin/require-owner.ts`,
`src/proxy.ts`, both Supabase clients — then verify each item against Supabase Auth docs:

- [ ] **Email-code / magic-link sign-in** for clients, localized da/en. Can we fully own the
      email (subject, template, sender) — i.e. use the admin "generate link" API and send via
      ZeptoMail ourselves — rather than Supabase's built-in SMTP templates? Owning the send is
      the whole point of the phase; if we can only skin their template, that's a finding.
- [ ] **Create-or-find a user by email, server-side, passwordless** — the exact behaviour of
      `ensureClerkUser`, used by the studio-created-booking flow (Task 06) to book for a client
      who has never signed in. This is load-bearing; confirm it exists.
- [ ] **Owner role.** Replace the Clerk session-token `metadata.role` claim. Decide: `clients.is_owner`
      flag + a `SECURITY DEFINER` `is_owner()` helper, or a custom JWT claim via an auth hook.
      Write the actual policy for one table and test it.
- [ ] **Route gating in `proxy.ts`** alongside next-intl, on the Node runtime, Next 16. Verify
      the Supabase SSR cookie pattern works there (this is where Clerk was genuinely convenient).
- [ ] **Authed Realtime.** The admin live queue subscribes with the authed browser client so
      owner-reads-all RLS scopes it. Confirm the same works with a Supabase-Auth session — this
      is a native path so it should be *simpler*, but verify, don't assume.
- [ ] **Rate limiting / lockout / abuse** on the email-code endpoint. What's built in, what do we
      add? Name the gap.
- [ ] **Session revocation** — the owner must be able to end a session; and account deletion must
      cascade correctly with our `clients` row.

**Deliverable:** a gap list. Any gap that needs custom code gets sized here, not discovered later.

---

## Spike 3 — Clerk data export & PII migration (~half a day)

**Question:** can we get the client data out, and what breaks if we can't?

- [ ] Enumerate what's actually stored per Clerk user today (email, first/last name, phone,
      `publicMetadata`) and how much of it the admin client directory depends on.
- [ ] **Can Clerk export password hashes?** Verify against their docs/support, don't assume.
      If no → every existing client re-onboards. At current volume that's fine, but it must be a
      planned communication, not a surprise. **Passwordless-only for clients removes this problem
      entirely** — which is the recommendation regardless.
- [ ] Write the mapping: `clerk_user_id` (text) → `clients.id` (uuid). Decide whether to keep
      `clerk_user_id` as a nullable legacy column for one release (recommended — it makes the
      migration reversible and lets both code paths coexist behind the flag).
- [ ] Count the rows actually affected across the six tables so the migration's real size is a
      number, not a feeling.

**Deliverable:** a `supabase/clients-and-auth.sql` draft (tables + RLS rewrite, not applied) and
a written rollback.

---

## Spike 4 — Scheduling engine: match today's behaviour (~2 days, the real one)

**Question:** can we generate the same slots Cal generates, and prove it before cutting over?

- [ ] **Extract the current truth from Cal** — the account's default availability schedule (all
      event types have `scheduleId: null`, so it governs everything), per-event buffers and
      notice. Phase 6 left "verify the default schedule is the real studio hours" open; that
      verification is now a prerequisite, because we're about to copy it into our DB. Confirm the
      real hours **with the owner**, don't just mirror whatever is configured.
- [ ] Design `availability_windows` + `availability_overrides`. Model closures, holidays, and
      one-off *open* blocks (the out-of-hours request flow in Phase 8 B exists precisely because
      Cal couldn't express these — we should now be able to).
- [ ] **Slot generation, in studio-local time.** Write it as a pure function
      (`windows, overrides, existing bookings, duration, buffer, notice, now` → slots) so it is
      unit-testable without a DB. Extend [`lib/studio-time.ts`](../../../src/lib/studio-time.ts).
- [ ] **DST tests are mandatory** — the two Europe/Copenhagen transitions, plus a booking that
      straddles one. This is the classic silent breakage and it only shows up twice a year.
- [ ] **The overlap constraint.** Prototype the `btree_gist` exclusion constraint from PLAN.md
      and **resolve the buffer question**: does the excluded range cover duration only, or
      duration + 30-min buffer? Test it by racing two concurrent inserts into the same slot and
      confirming exactly one survives with a catchable error (not a 500).
- [ ] **Parallel-run harness.** For a week, generate our slots and Cal's for the same inputs and
      diff them daily. Cutover criterion: **zero unexplained differences for 7 consecutive days.**
      Any difference is either a bug or a decision — both get written down.
- [ ] **Signed manage tokens** to replace `cancel_url` / `reschedule_url`: expiry, single-use or
      not, what happens on an expired link, and how the owner re-issues one.
- [ ] Own booking form fields — including the **phone** Cal currently collects
      ([`lib/cal-phone.ts`](../../../src/lib/cal-phone.ts)) and the consent copy already shipped
      on the confirm step.

**Deliverable:** the pure slot function + its test suite, the constraint, and 7 days of clean
diff output. No cutover task is written until the diff is clean.

---

## Spike 5 — Email infrastructure (~1 day, and it can start immediately)

Step 1 of the migration is additive and independent, so this spike can run in parallel with the
others.

- [ ] **ZeptoMail**: confirm EU data-centre availability, sending-domain setup (SPF/DKIM/DMARC on
      `bellanails.dk` — coordinate with the existing Zoho mail setup so we don't break it), API
      vs SMTP, and bounce/complaint webhooks.
- [ ] `scheduled_emails` schema: `kind`, `booking_id`, `send_after`, `sent_at`, `attempts`,
      `last_error`, unique `(booking_id, kind)` for idempotency.
- [ ] Drain job on **Vercel Cron** with `for update skip locked`. Decide the interval (a reminder
      that must land "24 h before" tolerates ~15 min drift; confirm with the owner).
- [ ] Templating: localized da/en, brand tokens, plain-text fallback. Decide the authoring
      approach — React Email vs. plain templates — and where the copy lives (i18n messages vs.
      DB, given Task 08's `consent_terms` already needs versioned text).
- [ ] ⚠️ **Sequencing safeguard:** disabling Cal's emails (step 2) and enabling ours must be one
      reversible switch. If ours fail silently, clients get *nothing* — worse than off-brand.
      Require a delivery log the owner can see and an alert on repeated failure before flipping.

**Deliverable:** working branded confirmation email sent from the existing Cal webhook, behind a
flag, with Cal's own emails still on. That's the safest possible first landing.

---

## Cross-cutting things not to forget

- [ ] **Rewrite Phase 6's end-to-end test scenario** and Phase 7's in-app-manage hardening list —
      both are written against Cal semantics and become misleading the moment the engine changes.
- [ ] **Stripe re-scope**: no-show holds were "free via Cal config". They now mean our own
      SetupIntents. Still deferred, but the plan must stop claiming it's zero-work.
- [ ] **`docs/SETUP.md` and `INFRASTRUCTURE.md`** both document Cal + Clerk setup as required
      steps. The stated goal is "any dev can restart the project without AI" — these go stale on
      cutover day.
- [ ] **Verify the Supabase project region is EU** (PLAN.md Phase 11). Independent of everything
      else here and worth knowing today.
- [ ] **`.env.example`** loses four Cal/Clerk keys and gains ZeptoMail + token-signing secrets.
- [ ] Schema consolidation (already an open Phase 9 follow-up) gets *more* urgent — this phase
      adds several migrations on top of an already-patchwork `supabase/*.sql`.

## Go / no-go

Per step, not for the phase as a whole:

| Step | Go when |
|---|---|
| 1 — Email infra | ZeptoMail EU + domain auth verified; delivery log visible to owner |
| 2 — Our emails on | Step 1 running behind a flag with a one-line revert |
| 3 — Artist calendar | Task 02 shipped **and the owner has used it for a week** |
| 4 — Own scheduling | 7 days of clean slot diff + DST tests + concurrent-insert test green |
| 5 — Identity | Spike 2 gap list closed; rollback rehearsed on a branch DB |

**No-go signals worth respecting:** Spike 2 finds we can't own the auth emails (then Clerk's
removal loses its main justification and only the GDPR argument remains — still valid, but
re-weigh the 60-file cost). Spike 4's diff won't converge (then the studio's availability rules
are more complex than we modelled — fix the model, don't ship an engine that offers wrong slots).
