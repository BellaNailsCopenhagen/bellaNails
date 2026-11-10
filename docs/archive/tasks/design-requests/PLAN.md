# Design requests & personal offers — plan

> The client asks. The artist answers with a **one-time offer** she prices and times
> herself. The client opens a signed link and books it like anything else.
>
> Decisions 31 Aug 2026. Supersedes the "inspiration photo" sketch in
> [product-review.md](../../product-review.md) §01.
> **Rev 2** — the offer is no longer a `services` row (see §4).

---

## 1. The decisions

| Question | Decision |
| --- | --- |
| How does a quote become a booking? | The artist creates a **one-time offer** — her time, her price — and sends a signed link. Opening it enters the normal booking flow. She can also book it for the client herself. |
| Conversation | **Async, like email.** Client sends a message + photos; the artist answers with an offer or a note. |
| Who can attach photos? | **Signed-in clients only.** No anonymous upload endpoint. |
| Access to an offer | **A signed token**, not a database permission (Raul, rev 2). |
| Storage | **Migrate Scaleway → Supabase Storage first**, as its own piece. |
| Client photos in the gallery | **Cut.** Artist photos only. |

---

## 2. What gets cut

| Cut | Detail |
| --- | --- |
| Client photo upload on past bookings | **Repurposed, not deleted** — the same spot becomes "Something not right? Tell Bella", which opens a **repair** request. |
| "Hundreds of photos" sizing | Storage need drops an order of magnitude. This is what makes §3 possible. |
| Client photos on public surfaces | No code change. `clients_gallery` / `showcase` read published assets regardless of who shot them; they get fed by the artist's photos now. |

**Media releases stay.** The artist's photos are photos of a client's hands, taken at the
studio — still that client's personal data. Only the client-as-photographer supply is gone.

---

## 3. Phase 0 — Scaleway → Supabase Storage

### The evaluation

Scaleway was chosen for **EU sovereignty** and a **75 GB free tier** sized for hundreds of
client photos. Both premises just changed.

**Sovereignty doesn't hold on its own.** Supabase Inc. is US-owned; Scaleway is French. But
every identifying field we hold — names, emails, phones, booking history — is *already* in
Supabase Postgres. Photographs of nails on a French bucket, with the names attached to them
on a US-owned platform, buys no real sovereignty. The exposure is conceded at the DB layer.

### Measured image sizes

Not estimates — encoded with **sharp / libwebp** (the same encoder Next uses) from a real
6240×4160 photograph, plus a native-resolution crop as a high-frequency close-up proxy
(nail macro shots compress worse than wide scenes) and a flat-colour screenshot as a
Pinterest/Instagram proxy.

| Treatment | Pixels | Wide photo | Close-up | Screenshot |
| --- | --- | --- | --- | --- |
| 2000px long side, q85 — **today** | 2.7 MP | 111 KB | — | 131 KB |
| 1600px long side, q85 | 1.7 MP | 81 KB | — | — |
| 1280px long side, q85 | 1.1 MP | 59 KB | — | — |
| 1024px long side, q85 | 0.70 MP | 41 KB | — | 53 KB |
| 1024px long side, q80 | 0.70 MP | **34 KB** | — | 45 KB |
| 1024px long side, q75 | 0.70 MP | 27 KB | — | — |
| 1024×1024 (1:1 crop), q85 | 1.05 MP | 60 KB | 79 KB | — |
| 1024×1024 (1:1 crop), q80 | 1.05 MP | 49 KB | **62 KB** | — |
| 1024×768 (4:3 crop), q85 | 0.79 MP | 48 KB | — | — |
| 1024×768 (4:3 crop), q80 | 0.79 MP | **39 KB** | — | — |
| 800×800 (1:1 crop), q80 | 0.64 MP | 33 KB | 36 KB | — |
| 640px long side, q80 | 0.27 MP | 16 KB | 18 KB | — |

> Browser `canvas.toBlob(…, "image/webp", 0.85)` is not byte-identical to libwebp — allow
> roughly ±20 % on these figures for the client-side path.

#### Two findings worth acting on

**1. Forcing a square at the same cap makes files *bigger*, not smaller.** A 1024×1024 crop
is 1.05 MP; a 1024px-long-side fit on a 3:2 photo is 0.70 MP. So "1:1 at 1024" costs
**+46 % pixels** — 60 KB vs 41 KB. A fixed ratio is a *consistency* decision, not a size
saving. If you want both, 4:3 at 1024×768 (39 KB) or 1:1 at 800×800 (33 KB).

**2. Quality is the cheaper lever than dimensions.** q85 → q80 saves ~18 % at identical
pixel dimensions, and is visually indistinguishable on nail photography. q75 saves ~35 % and
starts to show on glitter and fine linework.

### Capacity in 1 GB

| Per image | Images that fit |
| --- | --- |
| 34 KB (1024 long, q80) | **~30,000** |
| 45 KB | ~23,000 |
| 60 KB | ~17,500 |
| 111 KB (today's policy) | ~9,400 |

**Realistic annual growth**, at ~15 appointments/week (~780/year):

| | Per year | Size |
| --- | --- | --- |
| Artist keeps a photo on ~1 in 3 appointments | ~260 | ~16 MB |
| Published copies (a second, public file each) | ~60 | ~4 MB |
| Reference photos, 3-month purge → steady state | ~80 live | ~3 MB |
| Studio gallery + service images (one-off) | ~60 | ~4 MB |
| **Growth per year** | | **~20 MB** |

**1 GB is not the constraint.** Even tripling those assumptions gives 5+ years of runway, and
today's unoptimised 2000px policy would still fit ~9,400 images. Storage is the wrong thing
to worry about here.

### The policy — LOCKED (Raul, 31 Aug)

**One rule: 1200px longest side, quality 82.** No tiers, no per-surface exceptions.

Measured at that setting:

| Kind of image | Output | Size |
| --- | --- | --- |
| Wide photo | 1200×800 | 46 KB |
| Close-up / macro (nail detail) | 1200×1200 | 87 KB |
| Screenshot (inspiration grab) | 1200×554 | 61 KB |
| 4:3 crop | 1200×900 | 55 KB |
| 1:1 crop | 1200×1200 | 67 KB |
| **Blended average** | | **~62 KB** |

| | |
| --- | --- |
| 1,200 images | **73 MB — 7 % of the free tier** |
| The full 1 GB | ~16,900 images |
| Pro, 100 GB ($25/mo) | ~1.7 M images |

**Standing decision:** stop optimising for storage. If we ever fill 1 GB, the studio is busy
enough that a Pro upgrade is not a discussion. Egress is the number to watch, not bytes
stored.

#### The two rules that still apply

1. ⚠️ **Never crop a reference photo.** `image-downscale.ts` already refuses to
   (*"we never crop a client's photo"*) — keep it. A centre crop on a Pinterest grab can cut
   the design out of frame, and a screenshot's aspect ratio is arbitrary. Cropping to a fixed
   ratio is for **our** surfaces (gallery, showcase), where consistency is a design win.
2. **`next/image` downsizes but never upsizes.** 1200 is the stored ceiling; every smaller
   variant is generated from it. The one place this could show is a full-width gallery *lead*
   image on a retina screen, which would like ~1600. If it ever looks soft, that is **one
   image at 1600 (~80 KB)** — not a change to the policy.

Concretely: `IMAGE_MAX_DIM` 2000 → **1200**, and the webp quality 0.85 → **0.82**, both in
`shared/media-policy.ts` / `shared/image-downscale.ts`. One constant each, applies everywhere.

### The two things that actually matter

**1. Egress, not storage.** Free gives **5 GB/month**, shared with the database and realtime.
This holds only while public images go through `next/image`: Vercel fetches each (image,
width, quality) variant from the origin once and caches it at the edge, so origin egress
tracks variants, not visitors — roughly 60 MB to warm the whole gallery. Serve raw bucket
URLs and it scales with traffic instead.

**2. Published images are stored twice.** The model keeps the private original *and* a public
copy per purpose. A photo released for both website and social is **three files**. Still
trivial at these sizes, but it means "how many photos" is not the same as "how many files".

> ⚠️ **The rule that keeps this true:** never serve gallery images from the raw bucket URL or
> with `unoptimized`. Set a Supabase usage alert regardless.

### What the migration deletes

| Goes away | Replaced by |
| --- | --- |
| `src/platform/storage/scaleway.ts` (~190 lines) | `src/platform/storage/supabase.ts` (~70 lines) |
| `src/app/api/media/sign/route.ts` | nothing — the browser uploads directly under RLS |
| the presign dance in `src/shared/upload-media.ts` | a thin `storage.from().upload()` wrapper |
| `@aws-sdk/client-s3`, `s3-presigned-post`, `s3-request-presigner` | — |
| 6 `SCALEWAY_*` env vars | — |
| `publishToPublic` CopyObject + per-object ACL | `storage.from(private).copy()` |

Uploads are signed-in only, so the browser uploads with the user's own session and Storage
policies enforce the rules. That is what removes the presign route — the piece that exists
today only because S3 has no safe browser-side credential.

### Buckets

```
bella-private   (private)   private/{clientId}/…      originals, design refs
bella-public    (public)    public/…                  released + published copies

policies on storage.objects
  insert   client writes under their own clientId prefix · owner writes anywhere
  select   client reads their own prefix · owner reads all · public bucket world-read
  delete   owner only (erasure runs server-side)
```

### Steps

1. **Confirm the Supabase project region is EU.** If it isn't, this decision reopens.
2. Create both buckets + policies; set `allowed_mime_types` + `file_size_limit` per bucket.
3. `src/platform/storage/supabase.ts` implementing the current contract (`objectUrl`,
   `presignedGet` → `createSignedUrl`, `publishToPublic` → `copy`, `deleteObject`,
   `storageConfigured`). Keep the `not_configured` degradation convention.
4. Default `storage_provider` to `'supabase'` — the column already exists on `assets` and
   `client_media` from the Cloudinary migration, so the abstraction is in place.
5. ~~Re-upload the real gallery images~~ — **not needed**. Verified against the
   live project on 1 Sep: `assets`, `client_media` and `gallery_items` are all
   empty and every `services.image_url` is null. Nothing references the old
   bucket, so no legacy host allowance was kept.
6. Delete the Scaleway adapter, the sign route, the AWS deps, the env vars, and the
   `remotePatterns` entry in `next.config.ts`.

**Estimate: 1–2 days.** Ships alone.

---

## 4. The model — why the offer is *not* a service row

### Three options were on the table

| | Approach | Verdict |
| --- | --- | --- |
| **A** | A `services` row flagged `audience='personal'`, hidden by filters + RLS | ❌ pollutes the catalog; needs an in-code guard on a service-role path |
| **B** | A `services` row created **already archived**, reached via a token | ⚠️ clever — solves pollution for free, but overloads `archived_at` |
| **C** | **An `offers` table. No `services` row at all.** | ✅ **chosen** |

### What killed A

Two things, one of which I had missed:

1. **`services_name_en_unique` is a live unique index** on `lower(name_en)` where
   `archived_at is null`. The *second* offer named "Repair" would fail to insert. Working
   around that means machine-generating unique names ("Repair — Mia — 31 Aug"), which is
   exactly the pollution Raul flagged.
2. The booking create path runs with the **service role**, which bypasses RLS entirely. So
   the ownership check has to be hand-written in `buildBookingDraft` — a guard that, if ever
   missed, turns a service id into a bearer token.

### Why B is good but doesn't win

Raul's "create it archived" is genuinely clever: every existing query already filters
`archived_at is null`, so the admin list, the menu, the featured rail and the uniqueness
index all exclude it **for free**. That's real.

The problem is semantic. `archived_at` means *deleted*. Using it to mean *hidden but live*
merges two states that later need separating — the first "restore an archived service" or
"show archived" admin view leaks every offer ever made. And `getBookableService` filters
archived too, so the booking path needs a bypass — which puts the guard right back where A
had it, just relocated.

### Why C wins

**The booking engine barely depends on a service at all.** Reading `availability.ts`:
`loadSlotInputs` fetches the service for exactly one value — `durationMins`. Everything else
(settings, schedule, outside-hours flag, busy spans) is global.

And `toDisplayBooking` in `shared/booking-view.ts` is **already snapshot-first**:

| Field | Source |
| --- | --- |
| `serviceName` | `meta.serviceNameEn/Dk` snapshot, catalog only as fallback |
| `addonNames` | `meta.addonSnapshots` |
| `durationMins` | `meta.totalDurationMins` |
| `rebookable` | `Boolean(catalogEntry)` → **false for an offer**, which is correct |

So a booking made from an offer renders correctly everywhere with **zero changes** to the
view model. A one-time offer being non-rebookable falls out for free.

### `offers`

| Column | Notes |
| --- | --- |
| `id` | uuid pk |
| `client_id` | → `clients`, not null |
| `request_id` | → `design_requests`, not null |
| `name_en`, `name_dk` | what she's offering — no uniqueness constraint, ever |
| `duration_mins`, `price_cents` | her quote |
| `artist_note` | shown with the offer |
| `expires_at` | default +14 days |
| `booking_id` | set when used → **single-use** |
| `withdrawn_at` | she can pull it back |
| `created_at` | |

### The access token (Raul's idea — adopted)

HMAC over the offer id, reusing the proven `manage-token.ts` pattern: no table, no
migration, same secret. `/{locale}/offer/{token}`.

**This removes the bearer-token risk rather than mitigating it.** There is no `services`
row to over-permission and no RLS change to `services` at all. The token *is* the
authorization, verified server-side on every load and again at create, against:

```
signature valid  ·  not expired  ·  booking_id is null  ·  not withdrawn
·  if a client is signed in, it must be this offer's client
```

Consistent with the existing guest manage/approve links. A signed-in client also reaches the
same offer from My Space without a token.

### The one real coupling to fix

Three reschedule paths call `getAvailableSlots(meta.serviceId, …)`
([manage/[token]/page.tsx](../../../src/app/[locale]/manage/[token]/page.tsx#L66),
[admin/reschedule](../../../src/app/admin/reschedule/[id]/page.tsx#L45),
[actions.ts](../../../src/modules/booking/actions.ts#L241)). An offer booking has no service,
so they need to resolve duration from `meta.totalDurationMins` instead.

**We already owe this fix.** [FOLLOWUPS.md](../FOLLOWUPS.md) — *"Reschedule end vs. price
drift: prefer the as-booked `meta.totalDurationMins` snapshot for the new end."* This
feature forces the correct behaviour.

### Booking subject

One small resolver in front of the two entry points:

```ts
type BookingSubject = {
  ref: { kind: "service"; id: string } | { kind: "offer"; id: string }
  nameEn: string
  nameDk: string | null
  durationMins: number
  priceCents: number
  addons: SelectedAddon[]      // always empty for an offer
}
```

`resolveBookingSubject(db, ref, addonIds)` keeps today's service branch verbatim and adds a
trivial offer branch. `getAvailableSlots` takes `durationMins`; `buildBookingDraft` takes the
subject. The snapshot gains one nullable `offerId` beside `serviceId`. Roughly 40 lines moved,
nothing rewritten.

### The other tables

| Table | Holds |
| --- | --- |
| `design_requests` | Thread head — client, topic (`new_design` \| `repair` \| `other`), preferred window (free text), status (`open → offered → booked`, or `declined` / `expired`), `offer_id`. Realtime-published. |
| `design_messages` | Append-only, both directions. The client's opening message is row #1. No inbox UI — but without a reply path the artist falls back to Instagram, the channel this closes. |
| `design_refs` | Reference photos. Deliberately **not** `client_media`: third-party copyright, must never reach the publish pipeline, own short retention. |

**`services` is not touched.** No new column, no RLS change, no filter added to any of the
ten read functions in `db/services.ts`.

---

## 5. Keeping the admin clean

Raul's actual concern. Nine decisions, in priority order:

1. **The offer has no page of its own.** Its whole lifecycle lives *on the request card* —
   draft, sent, expired, booked. She never navigates anywhere, and there is no "Offers"
   section to accumulate.
2. **Nothing lands in Services.** Consequence of §4 — the Services tab stays at ~15 real rows
   forever, price history stays meaningful, name uniqueness keeps working.
3. **Prefill from the catalog.** "What is it?" is a combobox seeded with her real services:
   pick *Gel refill* → duration and price prefill, then she adjusts. Most offers become two
   taps, and her pricing stays anchored to the menu.
4. **Duration as chips**, not a dropdown: `30 · 45 · 60 · 90 · 120 · custom`. One tap on
   mobile.
5. **Four fields, nothing else.** No category, image, add-ons, sections, featured flag — none
   of the service editor applies to an offer.
6. **One "Needs you" list.** Booking requests and design requests interleave in the command
   centre by age, rather than sitting in two competing sections.
7. **Self-cleaning queue.** An expired offer closes its request automatically (`expired`).
   Nothing to tidy by hand.
8. **`/admin/new` gains "Open offers for this client"** in the service picker — scoped to the
   selected client, empty for almost everyone. That is the urgent path, and it also lets her
   book an offer she already sent.
9. **Reuse `admin-request-card.tsx` primitives** — contact chips, the slot sheet, the
   accept/reject pattern — so the queue reads as one thing rather than two card species.

---

## 6. The flows

### A — the client asks

```
CLIENT                          SYSTEM                     ARTIST
──────                          ──────                     ──────
Opens "Ask Bella"
 (service page, My Space,
  or a past booking → repair)
    │
    ├─ picks a topic
    ├─ attaches 1–3 photos ──▶  upload under their own
    │                            prefix, signed-in only
    ├─ writes a message
    └─ taps Send           ──▶  request: open           ──▶ in-app alert
                                message #1                  + email
                                refs ×3
                                     │
                           ack email ┘
                           "Bella will reply — this is
                            not a booking yet"
```

### B — the artist answers

```
ARTIST                                SYSTEM                  CLIENT
──────                                ──────                  ──────
Command centre → request card
 sees photos + message
    │
    ├─ [Reply] ───────────────▶ message #2  ─────────────▶ email
    │   a question, no offer                               (can reply)
    │
    └─ [Make an offer]
        prefill from a service, then
        name · duration · price · note
            │
            ├─ "Send her a link"  ──▶ offers row         ──▶ offer email
            │                          + signed token         (+ My Space card)
            │                         request: offered        → flow C
            │
            └─ "Book it for her"  ──▶ same offers row    ──▶ confirmation
                                       + the time picker      email + .ics
                                       limits ignorable
                                       request: booked
                                       offer.booking_id set
```

The second branch is the urgent / outside-hours path — the **existing `/admin/new` flow**
with the offer preselected. No new booking code.

### C — the client books the offer

```
CLIENT
──────
Taps the link  ──▶  /{locale}/offer/{token}
    │
    ├─ bad signature · expired · already used · withdrawn
    │      ──▶ friendly dead end, with a "ask again" link
    ├─ signed in as a different client  ──▶ rejected
    │
    ├─ sees the OFFER — name · duration · price · her note · their photos
    ├─ picks a time            normal slot picker, normal availability
    └─ confirms                normal confirm step, normal emails, normal .ics
            │
            └──▶ booking created
                 offer.booking_id set (single-use)
                 request: booked
```

### D — the repair path

```
My Space → a past appointment → "Something not right? Tell Bella"
    │
    └──▶ Ask Bella, prefilled: topic = repair, with the booking context
         → flow A, with an urgency hint on the artist's card
```

This is why the client upload isn't simply deleted. A photo of a lifted set is genuinely
useful, and it now feeds a flow that ends in a booking instead of a dead gallery pipeline —
finally backing the **studio guarantee** the home page already promises.

---

## 7. Designs

### Client · Ask Bella

```
┌──────────────────────────────────────────┐
│  ASK                                     │
│  Tell Bella                              │
│  what you have in mind                   │
│                                          │
│  She'll come back with a price and how   │
│  long it takes. This isn't a booking yet.│
│                                          │
│  ─────────────────────────────────────   │
│  What's this about?                      │
│   ◉ A design I've seen                   │
│   ○ A repair or a fix                    │
│   ○ Something else                       │
│                                          │
│  Photos            (up to 3, optional)   │
│   ┌─────┐ ┌─────┐ ┌ ─ ─ ┐                │
│   │  ▨  │ │  ▨  │ │  +  │                │
│   └─────┘ └─────┘ └ ─ ─ ┘                │
│   Screenshots are fine.                  │
│                                          │
│  Anything she should know?               │
│   ┌────────────────────────────────────┐ │
│   │ I'd love this in a dusty rose —    │ │
│   │ my nails are quite short.          │ │
│   └────────────────────────────────────┘ │
│                                          │
│  When would suit you?         (optional) │
│   ┌────────────────────────────────────┐ │
│   │ Ideally before the 20th            │ │
│   └────────────────────────────────────┘ │
│                                          │
│           [   Send to Bella   ]          │
│                                          │
│  She usually replies within a day.       │
└──────────────────────────────────────────┘
```

### Admin · the request card, before

```
┌ DESIGN REQUEST ─────────────── 2h ago ──┐
│  Mia Sørensen                    ✉   ☎   │
│  Repair · wants it before the 20th       │
│                                          │
│  ┌─────┐ ┌─────┐                         │
│  │  ▨  │ │  ▨  │   tap to enlarge        │
│  └─────┘ └─────┘                         │
│                                          │
│  "The corner of my ring finger lifted    │
│   after four days — everything else is   │
│   perfect."                              │
│                                          │
│  [ Make an offer ]   [ Reply ]     [ ✕ ] │
└──────────────────────────────────────────┘
```

### Admin · make an offer — four fields

```
┌ Make an offer ───────────────────────────┐
│  For Mia Sørensen                        │
│                                          │
│  Start from            (optional)        │
│  ┌────────────────────────────────────┐  │
│  │ Gel refill — 60 min · 550 kr    ▾  │  │  ← prefills the two below
│  └────────────────────────────────────┘  │
│                                          │
│  What is it?                             │
│  ┌────────────────────────────────────┐  │
│  │ Repair — single nail rebuild       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  How long?                               │
│  ( 30 ) (45) ( 60 ) ( 90 ) (120) (…)     │
│                                          │
│  Price                                   │
│  ┌──────────────┐  +0   +150   +300      │
│  │  350     kr  │                        │
│  └──────────────┘                        │
│                                          │
│  A note for her                (optional)│
│  ┌────────────────────────────────────┐  │
│  │ Easy fix — bring the nail if you   │  │
│  │ kept it.                           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Holds for   [ 14 days   ▾ ]             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ◉  Send her a link to book         │  │
│  │ ○  Book it for her now             │  │
│  │      ↳ opens the time picker,      │  │
│  │        limits can be ignored       │  │
│  └────────────────────────────────────┘  │
│                                          │
│            [   Send offer   ]            │
└──────────────────────────────────────────┘
```

### Admin · the same card, after — the offer's only home

```
┌ DESIGN REQUEST ────────── offer sent ───┐
│  Mia Sørensen                    ✉   ☎   │
│                                          │
│  Repair — single nail rebuild            │
│  45 min · 350 kr · holds until 14 Sept   │
│                                          │
│  Sent 2 days ago · not opened yet        │
│                                          │
│  [ Book it for her ] [ Resend ] [ Edit ] │
│                              [ Withdraw ]│
└──────────────────────────────────────────┘
```

### Client · the offer

```
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  │
│  │  YOUR OFFER FROM BELLA             │  │
│  │                                    │  │
│  │  Repair — single nail rebuild      │  │
│  │  45 min  ·  350 kr                 │  │
│  │                                    │  │
│  │  "Easy fix — bring the nail if     │  │
│  │   you kept it."                    │  │
│  │                                    │  │
│  │  ┌────┐ ┌────┐                     │  │
│  │  │ ▨  │ │ ▨  │  your photos        │  │
│  │  └────┘ └────┘                     │  │
│  │                                    │  │
│  │  Holds until 14 September          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Choose a time                           │
│  ┌────────────────────────────────────┐  │
│  │        [ month calendar ]          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### The offer email

```
Subject:  Bella has a time and a price for you

Hi Mia,

Repair — single nail rebuild
45 minutes · 350 kr

"Easy fix — bring the nail if you kept it."

        [  Choose your time  ]

This offer holds until 14 September.
It's yours alone — the link only works for you.
```

---

## 8. Where it goes

```
src/platform/storage/supabase.ts          ← phase 0, replaces scaleway.ts

src/db/design-requests.ts                 ← new
src/db/design-messages.ts                 ← new
src/db/design-refs.ts                     ← new
src/db/offers.ts                          ← new
                                          ← db/services.ts UNTOUCHED

src/modules/design/                       ← NEW DOMAIN
  index.ts                                  the public surface
  reads.ts                                  getMyRequests · getOpenRequests · getOfferByToken
  request-actions.ts     "use server"       createRequest · addMessage · closeRequest
  offer-actions.ts       "use server"       createOffer · withdrawOffer · bookOfferAsOwner
  offer-token.ts                            sign / verify — mirrors manage-token.ts
  refs.ts                                   upload bookkeeping + purge

src/modules/booking/subject.ts             ← NEW  resolveBookingSubject
src/modules/booking/booking-draft.ts       ← takes a subject
src/modules/booking/availability.ts        ← takes durationMins
src/modules/booking/actions.ts             ← reschedule duration from the snapshot (owed fix)
src/modules/notifications/design-email.ts  ← ack · artist alert · offer · declined

src/shared/design.ts                       ← topics, statuses, client-safe copy

src/app/[locale]/ask/                      ← the client form
src/app/[locale]/offer/[token]/            ← the offer page → booking flow
src/components/admin/design-request-card.tsx
```

Also: one new `OwnerNotificationKind` (`design_request`); three new `CommunicationKind`s
(`design_request_received`, `design_offer_sent`, `design_request_declined`); two routes; and
a proper next-intl pass — *not* a hand-rolled copy map like the booking-request UI
([FOLLOWUPS.md](../FOLLOWUPS.md)).

---

## 9. Phasing

| Phase | What | Est. |
| --- | --- | --- |
| **0** | Storage: Scaleway → Supabase. Ships alone. | 1–2 d |
| **1** | Schema (4 tables) · cut the client upload · repoint the button at "repair". Ships alone. | 1 d |
| **2** | `resolveBookingSubject` + the snapshot-duration reschedule fix, with tests. Ships alone. | 1 d |
| **3** | Client: `/ask` form, photo upload, ack + artist-alert emails, My Space list. | 2 d |
| **4** | Admin: request card in the command centre, photo viewer, Reply, Close. | 1.5 d |
| **5** | Offer: the four-field sheet, token, offer email, both branches (link / book now). | 2 d |
| **6** | Client: `/offer/{token}` → booking flow, the four guards, single-use, expiry. | 1.5 d |
| **7** | Repair entry, `design_refs` purge job, i18n pass, polish. | 1 d |

**~10–11 working days.** Phases 0–2 are independently shippable and each leaves the codebase
better on its own. 3–6 are the feature and land as one reviewable set.

---

## 10. Risks

| Risk | Handling |
| --- | --- |
| ~~A personal service id acts as a bearer token~~ | **Gone.** No service row exists; the signed token is the only way in, verified server-side on every load and at create. |
| **The offer link is a bearer token in an email** | Same posture as the existing guest manage/approve links. Bounded by expiry + single-use + withdrawable, and rejected outright if a *different* client is signed in. |
| **Reschedule of an offer booking** | Fixed properly in phase 2 by reading `meta.totalDurationMins` — a fix already owed per FOLLOWUPS. |
| **Supabase project region may not be EU** | Confirm before phase 0. If not, the storage decision reopens. |
| **Egress if `next/image` is bypassed** | Never serve gallery images from the raw bucket URL. Usage alert. |
| **Reference photos are third-party copyright** | Separate table, never in the release pipeline, purged after use. Say so in the form copy. |
| **The artist now owes a reply** | Async is promised ("usually within a day"), not instant. If latency becomes the complaint, that's the signal for push — not more UI. |
| **An offer holds no slot** | Accepted. If availability changes the client can't find a time; expiry keeps stale offers out of the queue. |
| **Spam** | Sign-in gates it. Still cap open requests per client (3) and photos per request (3). |

### Open — needs Raul

1. **Any production media to migrate?** If the buckets are test-only, phase 0 loses its
   riskiest step.
2. **Default offer expiry** — 14 days assumed.
3. **Should an expired offer auto-close its request, or return it to `open`?** Plan assumes
   auto-close with a "make another offer" action still available.
4. **Deposits on an offer?** Out of scope; the natural first customer for card holds if
   elaborate work starts no-showing.

---

## 11. As built — where the code differs from this plan

Built 31 Aug 2026 in one autonomous pass. Everything below is a deliberate
deviation, decided while implementing.

### Storage

| Planned | Built | Why |
| --- | --- | --- |
| Two buckets | **Three** — `media-private`, `media-refs`, `media-public` | Supabase enforces size/MIME **per bucket**. Two buckets would have forced the artist's 200 MB video allowance onto client uploads, losing the 5 MB client cap the S3 presigned POST used to enforce. |
| Delete `/api/media/sign` | **Kept**, now minting a signed *upload URL* | Safer and smaller. RLS on `storage.objects` would need the browser to know its own `clients.id` and would put the upload policy in SQL; the route already resolves the caller's role and picks the bucket. Storage keys stay server-side either way. |
| RLS policies on `storage.objects` | **None, deliberately** | Every path is server-mediated — a signed upload URL, a signed GET, or a service-role publish/delete. The private buckets are therefore reachable *only* through those grants, which is stricter than a policy set. |
| — | `closed_at` added to `offers` | The one-live-offer index needs an immutable predicate (`expires_at < now()` can't be indexed). `withdrawn_at` alone would have made an expired offer block every future offer on that request — a permanent dead end. `closed_at` is set by both a withdrawal and the expiry sweep; `withdrawn_at` still drives the client's wording. |
| — | `design_messages.read_at` dropped | Nothing read it. |

### Behaviour

- **Housekeeping is throttled, not scheduled.** `runDesignHousekeeping` runs from
  the admin home at most once an hour per process, alongside the page's reads
  rather than ahead of them. Every surface derives its live state from
  `offerState`, so an unswept row still renders correctly. A cron is still the
  right home ([SCHEDULER-OPTIONS.md](../in-house/SCHEDULER-OPTIONS.md)).
- **Two sweeps, not one.** Rows past `purge_after`, *and* objects in `media-refs`
  with no row at all — the form uploads on file-pick but writes rows on submit,
  so an abandoned form leaves an object a row-driven purge can never see.
- **The offer link is claimed atomically.** Two people holding the same link and
  picking *different* times both pass the liveness check and both insert (the
  overlap constraint only catches identical times). A compare-and-set on
  `booking_id` picks one winner; the loser's booking is cancelled.
- **Declining withdraws any live offer** — otherwise the signed link outlives the
  request and still books a real appointment.
- **Uploads are rate-limited** (20/hour/client, best-effort per instance). The
  per-request and per-client caps bound *rows*; an upload happens before any row
  exists.

### Picked up along the way

- **The image policy landed**: `IMAGE_MAX_DIM` 2000 → 1200, quality 0.85 → 0.82.
- **A test runner**, zero new dependencies — `node --test` over the TS sources
  with a 20-line resolver hook (`scripts/ts-path-hooks.mjs`). `pnpm test`.
- **Email chrome extracted** to `email-layout.ts`; `esc` had drifted into three
  copies, one of which escaped quotes while the others didn't. The shared one
  escapes quotes — templates interpolate into `href="…"`, so the laxer versions
  were an attribute-injection risk. Covered by a test.
- **The `.from("table")` lint rule was catching `Buffer.from("…")`** — a
  false positive that would have hit anyone. Now excludes the JS built-ins;
  verified it still catches a real table query outside `db/`.
- **`overrideRescheduleEnd` deduplicated** against the new `bookedDurationMins`.
- **The whole client-media write path removed.** `addOwnBookingMedia` went with
  the upload; `deleteOwnMedia` followed once Raul confirmed there are **no real
  clients** — with no client-uploaded photo in existence, the "you can still
  delete what you uploaded" argument had nothing to protect, and it was a live
  write endpoint plus a UI branch that could never render.
- **Everything that split media by who shot it collapsed.** With `source` now
  permanently `owner`: My Space's gallery lost its always-empty "yours" section,
  `ServiceGallery` stopped being `{studio, clients}` and became a flat list (the
  public service page's "From clients" section keeps its reviews), the asset-hub
  card's "client upload / studio" label became a constant, and `addClientMedia`
  lost a parameter with one possible value. `source` stays on the table as
  provenance; nothing reads it any more.

