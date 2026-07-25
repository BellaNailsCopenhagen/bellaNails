# Task 11 — Gallery, client images & consent (GDPR)

> Autonomous build (owner away, July 2026): "gallery — owned + client-owned
> images; image GDPR flow requesting approval for publishing; update client
> pages (admin + web) to show a client's linked images and requests; consent
> flows for using client data on site + social (SoMe)." Ties together Tasks 04
> (gallery), 07 (client media), 08 (photo-consent), 09 (client voice). Not legal
> advice — the consent model below is the engineering shape; confirm with Danish
> counsel / Datatilsynet.

## What already exists (build on, don't duplicate)

- **`assets`** — Cloudinary-backed image rows (`url`, `media_type`). **World-
  readable RLS** (`using(true)`), so it only ever holds *public* images.
- **`gallery_items`** — the curated public gallery (before/after, `sort_order`
  slots) shown on the home Studio section. Studio-owned, public.

So the public, studio-owned gallery is done. The new work is **client images +
consent** and **surfacing a client's media/requests in both apps**.

## The privacy line (the crux)

A client's private image (a photo of their set, or one they submitted) is
personal data. It must NOT sit in the world-readable `assets` table. So:

- **Private client media** lives in a new **`client_media`** table (owner + the
  client themselves can read; nobody else), with **Cloudinary authenticated
  delivery** (signed URLs) in a private folder.
- **Publishing = copy-on-consent.** Only when the client grants consent for a
  purpose do we copy the image to a *public* Cloudinary folder, insert a public
  `assets` row, and (for the site) a `gallery_item`. **Withdrawal deletes the
  public copy** (private original stays). The public surfaces only ever read
  the public copies — never `client_media`.

## Schema (`supabase/media-and-consent.sql`)

**`client_media`** — private, per-client images.
`id, clerk_user_id, source ('owner'|'client'), cloudinary_public_id, url,
service_id?, booking_id?, is_feature, in_gallery, caption?, created_at,
archived_at`. Partial-unique: one `is_feature` per `service_id` (the product
image). `source` = who created it (studio photographed the client vs the client
submitted it).

**`media_consents`** — per-image, per-purpose publish consent (the GDPR ledger
for images). `id, client_media_id, clerk_user_id, purpose ('site'|'some'),
status ('requested'|'granted'|'declined'|'withdrawn'), published_asset_id?
(the public copy), requested_at, decided_at, withdrawn_at`. Unique
`(client_media_id, purpose)`.

**`client_consents`** — using a client's *data* (not a specific image): name /
words on site or SoMe. `id, clerk_user_id, purpose ('testimonial_site' |
'testimonial_some' | 'name_site' | 'name_some'), status, requested_at,
decided_at, withdrawn_at`. Unique `(clerk_user_id, purpose)`.

**RLS**: all three — owner-reads-all (`metadata.role = 'owner'`) **plus** the
client reads their own (`jwt sub = clerk_user_id`). Every write is service-role
via owner/ client actions (never a client UPDATE policy). `assets` adds a
nullable `cloudinary_public_id` so published copies can be deleted on withdrawal.

## Consent state machine

`requested → granted | declined`; `granted → withdrawn`. **Publishing is allowed
only while `granted`.** The owner *requests*; the *client* decides (grant /
decline) and can *withdraw* any time. Withdrawal → unpublish (delete public
copy + gallery item) but keep the consent row (audit trail) stamped
`withdrawn_at`.

## Surfaces

- **Admin · service page** — the product's feature image + gallery images
  (studio-owned client media linked to the service).
- **Admin · client page** — the client's linked images (studio + client-
  submitted), each image's consent state per purpose, and **Request publish**
  (site / SoMe) actions. Plus the data-use consent requests (name / testimonial).
- **Web · /bookings (client)** — "Requests" section: the studio asked to publish
  *these* photos / use your name — **Approve / Decline**, and **Withdraw** for
  already-granted ones. This is the client's consent centre.
- **Web · /bookings client upload** — on a **past** booking the client can
  **share a photo of their finished set** ("Share your set"). Intent: celebrate
  the artist's work / strengthen the client-artist bond (NOT reference photos
  for an upcoming appointment). GDPR-clean: the client voluntarily uploads their
  OWN result photo → the artist may see it (legitimate interest); a **disclaimer**
  states it's shared with the studio, stays private, and is never published
  without separate consent; the client can delete it any time. Uploads go to a
  private Cloudinary folder via a signed browser upload (env-guarded).
- **Web · public gallery** — unchanged mechanism (`gallery_items` + public
  `assets`); client images appear only via the published copies created on grant.

## Planned — post-appointment nudge (opt-out)

After an appointment ends, nudge the client to **share a photo of their set**
and optionally leave a **testimonial** — the raw material for the gallery +
reviews, with consent. Channels (in priority order):

1. **In-app banner** on /bookings ("How did your set turn out? Share a photo").
2. **Web push** if the PWA is installed (reuse Task 05 push plumbing).
3. **Email** a short while after the appointment end (via Zoho), linking to the
   booking's upload.

**Opt-out is mandatory and layered:** a "not this time" (dismiss for this
appointment) and a "don't ask me again" (permanent). Store on the client (a
`client_consents`-style `nudge_optout` purpose, or a dedicated
`nudge_preferences` row) so all three channels honour it. Never nudge a client
who opted out; never nudge about a cancelled/no-show appointment. Trigger:
`end_time` passed + not opted out + no photo/testimonial yet. This is marketing-
adjacent but service-relationship framed — keep it a single, gentle,
opt-out-respecting prompt, not a campaign.

## Cloudinary (env-guarded — keys added later)

Uploads + copy-on-consent + delete go through Cloudinary. All calls are guarded
on `CLOUDINARY_*` env; absent, they return a typed "not configured" state — the
schema, consent flow, linking, and display still work, uploads/publishes just
report "storage not configured". (Per the standing "don't block on missing keys"
rule.)

## Status of this build

Model + migration + types + lib + consent actions + admin client-media UI +
client consent centre are built; Cloudinary is stubbed behind env. Public-
gallery auto-insert on grant and the SoMe hand-off (there's no SoMe API — SoMe
publishing is a manual studio step the consent merely authorises) are wired as
far as they can be without keys. Open decisions for review: retention of
declined/withdrawn media, and whether `name_*` consent gates existing testimonial
surfaces.

## Non-goals

- SoMe auto-posting (no API; consent authorises a manual post).
- Editing the existing public gallery curation UI (Task 04's scope).
- Bulk consent / marketing (separate consent, see the bulk-message discussion).
