# Task 08 — Photo publication consent (private → gallery/social)

> Read [`00-context.md`](./00-context.md) first. Depends on Task 04
> (gallery/Cloudinary plumbing) and Task 07 (client media). The client-side
> half renders on `/bookings` (signed-in surface that already exists).

## Goal

The artist likes a private client photo (Task 07) and wants it on the
website gallery and/or social media. This task is the consent machinery:
per-image request → client's recorded yes/no per purpose → copy-on-consent
into the public assets → an audit log that proves it — plus withdrawal.

## Legal ground rules (settled with owner, July 2026 — encode, don't relitigate)

- **License + consent, never "ownership transfer".** A ToS clause assigning
  upload ownership is unfair-terms bait and solves nothing: publishing an
  identifiable person for marketing needs a GDPR basis regardless of who
  owns the file. Artist-taken session photos: she owns copyright already —
  the consent requirement is identical.
- **Consent can't live in service terms** (Art. 7(4) — not freely given if
  bundled with getting the treatment). It is per-image, per-purpose.
- **Verbal yes is valid but undemonstrable** (Art. 7(1) accountability).
  The in-chair verbal yes is the *trigger* to send the request; the record
  is the client's tap. No artist-attested consent path in v1 — it would be
  the weak link that swallows the strong one.
- **Granular purposes**: `website` and `social` are separately grantable on
  one request (Datatilsynet granularity guidance).
- **Withdrawal as easy as granting** (Art. 7(3)): one tap, effective
  forward — unpublish from the gallery immediately; social takedown is
  best-effort/manual (the log records the withdrawal date either way).
- Internal/private reference photos stay on legitimate interest + privacy
  policy — NO blanket "session data" consent email exists. Consent enters
  only at publication.

## New DB concepts — `supabase/photo-consent.sql`

```sql
consent_terms (           -- versioned, immutable once referenced
  id uuid pk default gen_random_uuid(),
  kind text not null default 'photo-publication',
  version int not null,
  body_en text not null,
  body_dk text not null,
  created_at timestamptz not null default now(),
  unique (kind, version)
)

media_publication_consents (
  id uuid pk default gen_random_uuid(),
  client_media_id uuid not null references client_media(id),
  clerk_user_id text not null,          -- who must answer
  terms_id uuid not null references consent_terms(id),
  scopes_requested text[] not null,     -- subset of {website, social}
  scopes_granted text[],                -- what the client actually ticked
  status text not null default 'pending',
      -- pending | granted | declined | withdrawn
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  withdrawn_at timestamptz,
  published_public_id text,             -- Cloudinary copy in the PUBLIC folder
  gallery_item_id uuid references gallery_items(id)
)
```

- Terms rows are **append-only** (new version = new row; never edit a
  referenced one) — the log must prove exactly what text the client saw,
  in the language they answered in (store answered-locale on the consent
  row if cheap: `responded_locale text`).
- One pending request per (media, purpose-set) — re-asking after a decline
  is a NEW row (the log keeps the decline).
- **RLS**: owner full access (role claim). Client: `select` own rows via
  Clerk `sub`; responses go through an RLS-verified server action (stamp
  `scopes_granted`, `responded_at`, `status`) — never direct update policy
  on the log columns.
- Migration before deploy; regenerate types.

## Flow

**Artist side (admin, client page → photo):**
- Each photo tile shows its consent state: none (private) · pending ·
  granted (with scope chips) · declined · withdrawn.
- "Request permission" → pick scopes (website / social / both) → creates
  the consent row against the CURRENT terms version. The request surfaces
  in-app; optionally a prewritten `mailto:` nudge ("I'd love to feature
  this set — approve it here: <link>") since we have no transactional
  email yet (Zoho decided; client-PWA push could carry this later).

**Client side (`/bookings`):**
- A pending request renders as a card: the actual image, the terms text
  (localized, the referenced version — not "latest"), two independent
  checkboxes (website / social, both pre-unchecked — GDPR: no pre-ticked
  boxes), Confirm / Decline. Signed-in = identity is demonstrated.
- Granted items remain listed under a quiet "Photos you've shared" section
  with a **Withdraw** action per item — visible forever, one tap.
  (Task 09 widens this into a full "Photos of your nails" transparency
  section — every photo incl. private ones, states, answer-in-place.
  Build this section so it can grow into that, not as a one-off list.)

**On grant (server action, the copy-on-consent step):**
1. Copy the Cloudinary asset from the private client folder into the
   public gallery folder (`published_public_id`) — the private original
   stays the client's record, untouched.
2. If `website` granted: create the `gallery_items` row (unfeatured;
   the artist curates slots via Task 04) and link `gallery_item_id`.
3. If `social` granted: nothing automated — the grant is the artist's
   green light to post manually (posting pipeline was dropped, July 2026);
   the log row is her proof.

**On withdrawal:**
- Archive the `gallery_items` row + delete the public Cloudinary copy;
  stamp `withdrawn_at`, status `withdrawn`. Social: surface a "posted on
  social — take it down" reminder to the artist if `social` was granted.
- Task 07 erasure cascades here: deleting a client withdraws + unpublishes
  everything of theirs first, then erases.

## Out of scope

- Automated social posting or takedown (dropped decision stands).
- Artist-attested/verbal consent records (deliberate — see ground rules).
- Payment/likeness-fee handling; model releases for faces (nail photos are
  hands — if a face ever appears in frame, don't publish it, period).

## Acceptance criteria

- Full happy path: request (both scopes) → client sees image + versioned
  localized terms on /bookings → grants website only → public copy exists,
  gallery item exists, log row shows `scopes_granted={website}`, terms
  version, timestamps.
- Decline leaves the photo private and the declined row in the log;
  re-request creates a new row.
- Withdraw removes the gallery item + public asset within the same action;
  the private original and the log survive.
- A signed-in non-owner sees only their own consent rows; anon sees none.
- Bumping the terms text creates version N+1; old log rows still resolve
  to the exact text they were granted against.

## Prerequisite (owner)

- Write the actual terms text (short, plain-language, da+en): what "use on
  our website" and "use on our social media" mean, that withdrawal is
  one tap and takes effect going forward. Ships as `consent_terms` v1 seed.
