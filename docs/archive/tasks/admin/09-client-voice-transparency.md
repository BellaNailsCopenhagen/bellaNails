# Task 09 — Client voice & transparency (testimonials + "my photos")

> Read [`00-context.md`](./00-context.md) first. Depends on Task 04
> (testimonials table + admin CRUD), Task 07 (`client_media`) and Task 08
> (consent/withdraw plumbing). Unlike 01–08 this task is mostly
> **client-facing**: it lives on the signed-in `/bookings` surface (website
> and, later, the client PWA — same pages, so the "accessible endpoint on
> both" requirement is free).

## Goal

Two halves of the same idea — the client gets a voice and gets visibility:

1. **Testimonials from clients** — a client can share their opinion of the
   service, spontaneously or upon the artist's request. Nothing goes
   public without the artist publishing it.
2. **Transparency ("my photos")** — the client can see every photo the
   studio holds of their hands, see exactly which ones are featured on the
   site or approved for social, and withdraw that approval themselves —
   without asking, without emailing.

## Part 1 — Client-submitted testimonials

### Schema (extends Task 04's `testimonials` table — coordinate, don't fork)

Task 04's table gains submission columns (same migration or a follow-up
`supabase/testimonial-submissions.sql`):

- `clerk_user_id text` — nullable; null = artist-entered (Task 04 path)
- `source text not null default 'studio'` — `'studio' | 'client'`
- `status text not null default 'published'` for studio rows;
  client rows arrive `'pending'` — `pending | published | declined`
  (replaces/absorbs the bare `is_published` boolean — decide in Task 04's
  final schema so there's one truth, not two)
- `display_name text` — how the client chose to be credited (see below)
- `submitted_at timestamptz`

New small table `testimonial_requests`:

```sql
testimonial_requests (
  id uuid pk default gen_random_uuid(),
  clerk_user_id text not null,
  booking_id uuid references bookings(id),   -- "how was your Shellac?" context
  requested_at timestamptz not null default now(),
  testimonial_id uuid references testimonials(id),  -- set when answered
  dismissed_at timestamptz                   -- client said "no thanks" — don't re-nag
)
```

- **RLS**: testimonials keep public read for `status = 'published'` only
  (the home section reads this); clients insert/select own rows via Clerk
  `sub` (insert forced to `status='pending'`, `source='client'` — policy
  `with check`, not UI trust); owner full via role claim.
  `testimonial_requests`: owner writes, client reads/dismisses own.

### Client flow (on `/bookings`)

- A quiet **"Share your experience"** entry — always available
  (spontaneous path), plus a prompt card when an open request exists
  ("How was your appointment on 12 Jul?" — the booking context from the
  request row). One-tap dismiss on the card (stamps `dismissed_at`).
- The form: quote (single language, as given — Task 04 decision),
  a **credit choice** the client controls: first name ("Sofie") · initial
  ("S.") · anonymous. Stated plainly above the submit button: *"If we
  feature your words, they appear on our website exactly as credited
  here."* — that sentence is the consent, collected at the point of
  submission (no separate consent flow needed; submission IS the request
  to be featured).
- After submit: "Thanks — Veronica reads every one." The client sees their
  own submission with its state (pending / published / not used). They can
  delete their own pending submission.

### Artist flow (admin, extends Task 04's testimonials screen)

- Pending submissions surface at the top as a small moderation queue:
  publish · decline (decline is silent — no rejection email; the client
  sees "not used" in neutral wording, never a red state).
- **"Ask for a review"** action in two places: a past booking in the queue
  history (Task 02) and the client page (Task 07) → creates a
  `testimonial_requests` row → the prompt card appears on the client's
  /bookings. Optional prewritten `mailto:` nudge, same pattern as Task 08.
- Editing a client-submitted quote: allowed for typos/trimming, but the
  card shows "edited" to the artist (never silently rewrite someone's
  words into marketing copy — if it needs rewriting, decline and ask).

## Part 2 — "My photos" (transparency + self-service withdrawal)

**RLS change this task makes deliberately** (Task 07 shipped owner-only on
`client_media` and flagged this as a future explicit decision — this is
that decision): add client **select-own** on `client_media`
(`clerk_user_id = sub`, `archived_at is null`). Still no client writes.

On `/bookings`, a **"Photos of your nails"** section:

- Every non-archived `client_media` row for the signed-in client — served
  via the same authenticated Cloudinary delivery (signed URLs minted
  server-side; RLS alone isn't enough, the CDN URLs must stay non-guessable).
- Each photo shows its plain-language state: **Private** ("only Veronica
  sees this — it's her reference for your next set") · **Asked** (pending
  Task 08 request → answer it right there) · **Shared** (chips: On our
  website / Approved for social) · **Withdrawn**.
- **Withdraw** on any shared photo = Task 08's withdrawal action, no new
  machinery — unpublishes the gallery copy immediately, social-takedown
  reminder to the artist. The point of this section is that retracting
  approval is self-service and permanent-visible, which is exactly what
  Art. 7(3) wants and what makes clients comfortable saying yes.
- If the client wants a private photo *gone entirely*: v1 keeps that as a
  contact-the-studio line under the section (erasure of reference photos
  is a conversation, not a button — the artist may need it for an upcoming
  booking; a delete-request button can come with the client PWA).

### What we deliberately do NOT show: artist notes

The owner asked whether notes should be visible too. **Recommendation: no
proactive display.** Reasoning: (a) legally, access is already guaranteed
on request (Art. 15) and the privacy policy names the notes — compliance
doesn't require a live feed; (b) a live feed turns a working tool into a
performance — the artist starts writing FOR the client instead of for the
next appointment, which kills the tool's value; (c) the "write as if the
client will read it" rule already keeps the content safe to disclose.
The transparency section gets one honest line: *"Veronica keeps short
service notes (your preferences, colors, fit) to make your next visit
better. Want a copy? Write to hello@bellanails.dk."* Revisit only if
access requests actually arrive.

## Out of scope

- Star ratings / structured review scores — quotes only, on-brand.
- Public review-platform syndication (Trustpilot/Google) — separate
  owner decision, different legal surface.
- Client-side photo deletion button (see above — contact line in v1).
- Push/email notification when a photo/testimonial request arrives —
  rides on the client-PWA exploration; until then the card waits on
  /bookings and the artist can nudge via mailto.

## Acceptance criteria

- Signed-in client submits a testimonial (each credit option) → row lands
  `pending`/`source='client'`; nothing public changes until the artist
  publishes; the home testimonials section then shows it with the chosen
  credit; declined shows neutrally client-side.
- Artist requests a review from a past booking → prompt card with that
  booking's context appears on the client's /bookings; dismiss works and
  is permanent for that request.
- "Photos of your nails" shows exactly the signed-in client's photos with
  correct states; anon/other clients get zero rows (RLS verified);
  withdrawing a featured photo removes it from the public gallery in the
  same action.
- A pending Task 08 consent request is answerable from this section (one
  surface, not two).
- Direct Supabase queries as a signed-in non-owner cannot read any other
  client's media or pending testimonials.
