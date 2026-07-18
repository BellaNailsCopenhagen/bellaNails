# Task 07 — Client directory (CRM-lite)

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01 (shell)
> and Task 02 (queue cards link into client pages). Strong synergy with
> Task 06 (new-booking flow prefilled from a client page).

## Goal

The artist can see **every client who has ever booked**, reach them outside
a booking context (call / email), book for them faster, and keep a working
memory per client: full booking history, her own notes ("prefers short
almond, thin cuticles — file gently"), and reference photos of previous
sets. This is the studio's client book — private, owner-only.

## Is this legal? (asked by owner — the honest answer)

**Yes, with boundaries.** Under GDPR the studio is the controller and has a
lawful basis to hold and view client contact data outside a single booking:
**Art. 6(1)(b)** (administering the ongoing service relationship) and
**6(1)(f)** (legitimate interest in client care/recall). The boundaries:

1. **Purpose limitation** — this data is for appointment administration and
   service quality. Using the directory for marketing blasts needs separate
   consent (Danish marketing law is strict on unsolicited email). "Send
   email" here = individual correspondence, which is fine.
2. **Notes are disclosable** — clients can demand everything we hold on
   them (Art. 15 access request). House rule for the notes field, surfaced
   in the UI as a permanent quiet caption: *"Write as if the client will
   read it."* Factual, service-related only.
3. **Health data is special-category (Art. 9)** — allergies etc. The safe
   pattern (already in place): the CLIENT volunteers it in their booking
   note. The artist's own notes must not accumulate health commentary
   beyond restating what the client provided for safe treatment.
4. **Client photos are personal data.** Private reference use is covered by
   the same basis. **Publishing to the public gallery is not** — that needs
   explicit consent. This task keeps client media strictly private; the
   promote path is [Task 08](./08-photo-consent.md) (per-image, per-purpose
   recorded consent + copy-on-consent + withdrawal).
5. **Erasure must actually work** — see the delete flow below.

Prerequisite (owner): one privacy-policy paragraph covering client records
(notes + reference photos, retention, erasure contact). Add to the
waiting-on-owner list with the terms text.

## Identity model (unchanged — this is the point)

PII stays in **Clerk**; our DB stays pseudonymous. The directory is:

- **Roster** = `select distinct clerk_user_id from bookings` (owner-reads-all
  RLS from Task 01) — clients who have actually booked, which is exactly
  the population the owner asked for.
- **Names/emails/phones** = Clerk Backend API (`clerkClient().users.getUserList`
  with the id list; its `query` param powers search by name/email). Fetched
  per request in owner-verified server code, rendered, **never persisted** —
  same rule as the queue (Task 02).
- Scale sanity: a one-artist studio's lifetime client count is hundreds,
  not millions. Batch `getUserList` by id chunks; paginate the UI; no cache
  table.

## New DB concepts — `supabase/clients.sql` (this task creates it)

Two tables, both keyed by `clerk_user_id text not null`, both soft-delete:

```sql
client_notes (
  id uuid pk default gen_random_uuid(),
  clerk_user_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
)

client_media (
  id uuid pk default gen_random_uuid(),
  clerk_user_id text not null,
  cloudinary_public_id text not null,
  url text not null,
  caption text,                          -- one language, as typed; not client-facing
  booking_id uuid references bookings(id),  -- optional "from this appointment" link
  created_at timestamptz not null default now(),
  archived_at timestamptz
)
```

- Indexes on `clerk_user_id` (both tables).
- **RLS: owner-only** — same role-claim policy shape as owner-reads-all on
  `bookings` (Task 01), for select AND write. No anon/authenticated access
  of any kind in THIS task. (Task 09 later adds a deliberate
  client-select-own policy on `client_media` for the "my photos"
  transparency section — that's its decision to make, not a default here.
  `client_notes` stays owner-only permanently.)
- `client_media` lives in a **separate Cloudinary folder with authenticated
  delivery** (signed URLs), NOT the public gallery assets. Private means
  private at the CDN too.
- Migration before code deploys; regenerate `src/lib/supabase/types.ts`.

## In scope

- **`/admin/clients`** — list: search (Clerk `query`), rows = name +
  quiet caption (last visit · total visits, from a grouped bookings read).
  Alphabetical; recently-seen first is fine too — pick one, don't build a
  sort UI.
- **`/admin/clients/[clerkUserId]`** — the client page:
  - Header: name, email, phone (from Clerk) + tap actions **Call** (`tel:`),
    **Email** (`mailto:` — Zoho is the mail client, decided), **New booking**
    (→ Task 06 flow with client + email prefilled, skipping step 1).
  - **Booking history**: all rows for this `clerk_user_id`, upcoming +
    past, reusing `BOOKING_DISPLAY_COLUMNS` / `toDisplayBooking` /
    `fetchBookingCatalog` — the /bookings page anatomy at admin scale.
  - **Notes**: timestamped entries, newest first — add / edit / archive
    (server actions, owner re-verified). Free text; the "client can read
    this" caption always visible.
  - **Photos**: grid of `client_media`, upload from camera roll (same
    signed-upload plumbing as Task 04 gallery, different folder +
    authenticated delivery), optional caption, optional link to a booking,
    archive. Tapping opens full-size.
- **Client record CRUD (Clerk-backed)**:
  - Edit **name and phone** via Clerk Backend API update (server action).
    **Email stays read-only in v1** — it's the sign-in identity; changing
    it can lock the client out of their own /bookings. If it must change,
    the artist creates a fresh booking with the new email (new Clerk user).
  - **Delete client = GDPR erasure** — AlertDialog spelling out exactly
    what happens: Clerk user deleted (PII gone), notes + media hard-deleted
    (not archived — erasure means erased; purge the Cloudinary assets too),
    booking rows kept but now dangling on a dead pseudonymous id (lawful:
    business records, no PII). If upcoming bookings exist, the dialog
    blocks until they're cancelled — never delete someone with a live
    appointment. Once Task 08 exists, erasure first withdraws/unpublishes
    any consented public copies, then erases.
- **Queue integration** (touches Task 02): the client name on a queue card
  links to the client page.

## Out of scope

- Marketing/bulk email, message templates, campaigns (consent territory +
  decided email = Zoho, not in-app).
- Promote-client-photo-to-gallery → [Task 08](./08-photo-consent.md)
  (design the photo tile so a consent-state chip can sit on it later).
- Merge-duplicate-clients tooling (rare at this scale; Clerk dedupes by
  email, which is the real identity).
- Client-visible anything: notes, media, and the directory are owner-only.

## Acceptance criteria

- Every email that ever completed a booking appears in the directory;
  search by first name and by email fragment both hit.
- Client page shows live contact data from Clerk, full booking history,
  notes CRUD, photo upload/view — on a phone, one-handed.
- "New booking" from a client page lands in the Task 06 flow with client
  identity prefilled.
- A non-owner (signed-in regular client) gets nothing from `client_notes` /
  `client_media` via the API surface or direct Supabase queries (RLS
  verified, like the bookings policy was).
- Erasure flow: delete a test client → Clerk user gone, notes/media rows
  gone, Cloudinary assets gone, booking rows intact, directory entry gone
  (roster join finds no Clerk user → filtered out).
