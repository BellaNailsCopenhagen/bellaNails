# Storage Migration — Cloudinary → Scaleway Object Storage

> **Why:** move artist/client image storage to an EU-native, GDPR-sovereign provider (Scaleway, France — no US parent / CLOUD Act exposure) with a generous free tier (75 GB storage + 75 GB egress/month). All storage access is server-mediated: Scaleway keys never reach the browser, including when the client site is installed as a PWA.
>
> **Related:** [PROJECT_BIBLE.md](../../PROJECT_BIBLE.md) · [docs/PLAN.md](../PLAN.md) · [docs/INFRASTRUCTURE.md](../INFRASTRUCTURE.md) · [docs/tasks/explorations/auth-ownership-and-gdpr.md](explorations/auth-ownership-and-gdpr.md)
>
> Legend: ✅ done · 🔼 in progress · ⬜ not started

---

## Design decisions (locked before build)

1. **Server-mediated presigned uploads, not browser-direct-with-secret.** Cloudinary allowed a signed browser upload because the signature is safe to expose. S3/Scaleway has no equivalent — the access key must stay server-side. So the browser asks our Next.js route handler for a **short-lived presigned `PUT` URL**, then uploads the bytes straight to Scaleway with that URL. Bytes never pass through our serverless function (avoids Vercel body-size/duration limits), and this preserves the current `booking-photos.tsx` upload shape.
   - Holds for the installed PWA: the PWA is only the client shell. The presign request still hits our server route where `SCALEWAY_SECRET_KEY` lives. The service worker must treat the presign call and presigned URLs as **network-only** (never cache — presigned URLs expire).
   - ⚠️ **No service worker exists in the repo today** — this and the Phase 9 PWA checks are forward-looking constraints to honour *if/when* a SW lands, not work items for this migration.

2. **Private-by-default bucket, publish-on-consent.** Mirror today's Cloudinary `private/` → `public/` model with two key prefixes in one bucket:
   - `private/` — all uploads land here. Bucket blocks public reads. Owner/client view via short-lived **presigned `GET`** URLs.
   - `public/` — only consented, published gallery assets. Served via the public bucket URL (or a CDN/custom domain) and allowed in `next/image`.
   - Publishing = `CopyObject` private → public (matches `publishToPublic`); revoking/erasing = `DeleteObject`.

3. **Keep the `src/lib/cloudinary.ts` contract; add a Scaleway implementation behind it.** New module `src/lib/storage/scaleway.ts` implements the same operations plus a presigned-GET for private reads. The `"not_configured"` graceful-degradation convention is preserved so the app still boots without keys.

4. **Region = `fr-par` (Paris)** for EU residency. `nl-ams` (Amsterdam) is the alternate. Decide once; it's baked into the endpoint.

5. **EXIF/GPS stripping becomes our responsibility.** Cloudinary stripped metadata via `f_auto`/transforms. Scaleway stores bytes as-is. We must strip EXIF (esp. GPS) ourselves — see Phase 7. This is a GDPR data-minimisation requirement, not optional.

6. **Additive schema change, not a rename.** Add `storage_key` + `storage_provider` columns alongside the existing `cloudinary_public_id` (made nullable). Lets old and new coexist during cutover; drop the Cloudinary column later.

7. **Presigned `PUT` cannot enforce a max file size.** The signature covers the key + content-type, not the body length — a caller can `PUT` an arbitrarily large object. Two ways to bound it: (a) use a **presigned `POST`** (`@aws-sdk/s3-presigned-post`) with a `content-length-range` policy condition, or (b) keep presigned `PUT` and, after upload, **`HeadObject` and `DeleteObject` if oversized**, plus a hard client-side size gate. Recommendation: presigned `POST` — it's the only server-enforced cap and also lets us pin content-type. (This changes the client from `fetch(url, {method:'PUT', body})` to a multipart form post; note it in Phase 3.)

8. **`public/` is made readable per-object via `ACL: public-read`, NOT a bucket policy.** ⚠️ Verified live: on Scaleway a **bucket policy becomes the sole authority for the bucket** — set one that only grants anonymous `public/*` read and it **locks the owner's own key out** of every other operation (list, CORS, put/delete), returning `AccessDenied`. So we do **not** use a bucket policy. Instead `publishToPublic` sets `ACL: "public-read"` on each `CopyObject` into `public/` (proven: private object → anon 403, public+ACL object → anon 200). The bucket stays Private; uploads to `private/` have no ACL. `infra/scaleway/bucket-policy.json` is retained only as a reference for the (rejected) policy approach — do not apply it.

9. **Two upload policies, keyed off role.** The presign route already knows the caller (`auth()` + `isOwner`); it issues a **different presigned policy per role**. See the table below.

---

## Upload policy by role

| | **Client** (from `/bookings`) | **Owner / artist** (admin) |
|---|---|---|
| Allowed types | `image/jpeg`, `image/png`, `image/webp` only | images **+ video** (`video/mp4`, `video/webm`) — the "demo video" exception |
| Files per action | **one at a time** (no multi-select) | one at a time (video is large; keep it simple) |
| Client-side processing | **required**: strip EXIF → downscale (canvas pass), **aspect ratio preserved — no crop** | none forced — owner controls their own content; video is stored as-is (we have no transform layer) |
| Max size (presigned-POST `content-length-range`) | small — post-optimisation an image is well under **~5 MB** | large — **video cap ~200 MB** (a knob; watch the 75 GB free tier) |
| Rendered as | `<img>` (private via presigned GET; public via CDN URL) | `<img>` for images, **`<video controls>`** for video |

- **No cropping.** Client photos keep their original aspect ratio — clients don't shoot to a fixed frame, so cropping would chop their set. The gallery grid handles varied ratios in CSS instead. (Client images are still downscaled + EXIF-stripped; owner uploads untouched.)
- The route picks the policy by role; a client requesting a `video/*` presign is rejected server-side (never trust the client-side gate alone).
- **Rationale:** the client path is the abuse/cost surface (public booking flow) → tight caps + forced optimisation. The owner is trusted and occasionally needs a heavier demo asset → wider allowance. Both still go through the same presigned-upload machinery; only the policy differs.

---

## Phase 0 — Scaleway account & bucket setup (manual, one-time) ✅

- ✅ Create Scaleway account; create Project "bellaNails".
- ✅ Create Object Storage bucket `bellanails-media` in **`fr-par`**, visibility **Private**.
- ✅ Generate an API key (bearer = owner, preferred Project = bellaNails). Values in `.env.local`.
- ✅ **CORS applied** via the `aws` CLI — `PUT/POST/GET/HEAD` from `localhost:3000`, `test.bellanails.dk`, `bellanails.dk`, `www.bellanails.dk`.
- ✅ **Do NOT set a bucket policy** (decision 8 — it locks the owner out). Public delivery is per-object `ACL: public-read`, set on publish. Verified: private → 403, public → 200.
- ⬜ Confirm free-tier limits and set a billing alert.

## Phase 1 — Dependencies, env, config ✅

- ⬜ `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (presigned GET/PUT). Add `@aws-sdk/s3-presigned-post` too if going with presigned-POST uploads (decision 7 — recommended for the size cap).
- ⬜ Add env var **names** to `.env.example` (and real values to `.env.local`):
  - `SCALEWAY_ACCESS_KEY`
  - `SCALEWAY_SECRET_KEY`
  - `SCALEWAY_REGION` = `fr-par`
  - `SCALEWAY_ENDPOINT` = `https://s3.fr-par.scw.cloud`
  - `SCALEWAY_BUCKET` = `bellanails-media`
  - `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` = `https://bellanails-media.s3.fr-par.scw.cloud` (for building public image URLs client-side)
- ⬜ `next.config.ts` → `images.remotePatterns`: add the Scaleway public host (`bellanails-media.s3.fr-par.scw.cloud`, path `/public/**`). Keep `res.cloudinary.com` until cutover is done, then remove.

## Phase 2 — Storage abstraction module ✅

- ⬜ Create `src/lib/storage/scaleway.ts` (`import "server-only"`) exposing, behind the same contract as `cloudinary.ts`:
  - `storageConfigured(): boolean` — all Scaleway env vars present.
  - `presignedUpload({ prefix, contentType, maxBytes }): Promise<Result<{ url, key, fields? }>>` — returns presigned upload params into `private/…` with a generated object key. Prefer **presigned `POST`** with `Conditions: [["content-length-range", 1, maxBytes], {"Content-Type": contentType}]` so size + type are server-enforced (decision 7); the returned `fields` are appended to the multipart form. `maxBytes` + the allowed content-type come from the **role policy** (decision 9), so the caller passes the resolved values.
  - `presignedGet(key): Promise<Result<{ url }>>` — short-lived presigned `GET` for private reads (owner/client viewing).
  - `publishToPublic(privateKey): Promise<Result<{ key, url }>>` — `CopyObject` `private/…` → `public/…`, return public URL.
  - `deleteObject(key): Promise<Result<void>>` — `DeleteObject` (used for both private and published copies).
  - Reuse a `Result<T>` shape with a distinct `"not_configured"` error, matching `CloudinaryResult<T>`.
- ⬜ Single shared `S3Client` instance configured with `{ region, endpoint, credentials }`. Use **virtual-hosted-style** (Scaleway's default) so presigned URLs share the same host shape as `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` — i.e. **do not** set `forcePathStyle: true` (path-style would emit `s3.fr-par.scw.cloud/<bucket>/…`, inconsistent with the public base URL and deprecated on AWS).

## Phase 3 — Upload route handler + client flow ✅

- ⬜ Rework `src/app/api/media/sign/route.ts` to return **Scaleway presigned upload params** instead of Cloudinary signed params. Keep the auth guard (`await auth()` → 401) and **branch on `isOwner`** to pick the role policy (decision 9): resolve `{ allowedTypes, maxBytes }`, validate the requested content-type against them, and **reject a client requesting `video/*`** (403). Pass the resolved values into `presignedUpload`.
- ⬜ Update `src/components/sections/booking-photos.tsx` (client): **single-file** picker (no `multiple`), run the strip→downscale pass (Phase 7, no crop) → request presign → upload (`POST` multipart) → send the returned `key` + detected `kind` to the insert action.
- ⬜ Update `src/components/admin/client-media-section.tsx` (owner): new upload UI (currently URL-paste) accepting images **and video**, no forced crop. Same presign → upload → insert flow.
- ⬜ Persist the returned object **`key`** (not a Cloudinary public id) into the media row (see Phase 5).

## Phase 4 — Consent publish + GDPR erasure ✅

- ✅ `src/lib/actions/client-consent.ts`: `publishToPublic` = CopyObject `private/`→`public/` **with `ACL: public-read`** (decision 8); revoke = `deleteObject` on the public key.
- ⬜ `src/lib/media-erasure.ts` (`purgeMediaArtifacts`): delete **both** the `private/` and any `public/` object for a record via `deleteObject`. This is the true-erasure path — verify it removes every stored copy.

## Phase 5 — Schema migration ✅ (apply supabase/storage-provider.sql)

- ⬜ New `supabase/storage-provider.sql` (applied via Supabase MCP, matching existing loose-SQL convention):
  - `assets`: add `storage_key text`, `storage_provider text default 'scaleway'`. (`assets.cloudinary_public_id` is **already nullable** in the current types — no change needed there.)
  - `client_media`: add `storage_key text`, `storage_provider text default 'scaleway'`, **`kind text default 'image'`** (`image` | `video`, so rendering + validation know which — needed for the owner video exception); drop the `NOT NULL` on `cloudinary_public_id` (currently `string`, i.e. required).
- ⬜ Update `src/lib/supabase/types.ts` (hand-maintained `Database` types) to match.
- ⬜ Update inserts in `src/lib/actions/manage-media.ts` + `client-media.ts` to write `storage_key` + `kind` (client action always `image`; owner action `image`/`video` from the uploaded type).
- ⬜ (Later cleanup, post-cutover) drop `cloudinary_public_id` once no rows depend on it.

## Phase 6 — Private reads + next/image ✅

- ⬜ Wherever private client images render (admin client directory, client account media), fetch a short-lived `presignedGet` URL server-side and pass it down — do **not** expose the bucket key or long-lived URLs.
  - Render private images with a plain `<img>` (as `client-media-section.tsx` already does), **not** `next/image`: the optimizer caches by URL, and an expiring presigned URL changes every render → cache churn + eventual stale-URL 403s. `next/image` is only for the stable `public/` URLs.
  - Branch on `kind`: `image` → `<img>`; `video` → `<video controls preload="metadata">` (owner demo videos). Same presigned-GET rule for private, public URL for consented.
- ⬜ Public gallery (`src/app/[locale]/gallery/page.tsx`, `assets`/`gallery_items`) builds URLs from `NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL` + `storage_key`.

## Phase 7 — Metadata stripping + validation ✅ (client downscale/strip, no crop)

- ⬜ **Client images only** — one canvas pass: strip EXIF/GPS (GDPR data-minimisation) → **downscale** (longest side ≤ `IMAGE_MAX_DIM`, **aspect ratio preserved — no crop**) → re-encode webp. Doing it client-side means raw metadata never leaves the device and the 10 MB-file problem disappears. ⚠️ A canvas re-encode **drops the EXIF orientation flag**, so `createImageBitmap(file, { imageOrientation: "from-image" })` bakes rotation in first, or portrait photos land sideways.
- ⬜ **Owner uploads are exempt** from crop/downscale. Images: optional light re-encode is fine; **video is stored as-is** (no client transform layer). Still strip nothing server-side for video — just enforce type + size via the presign policy.
- ⬜ Validate content-type + size on **both** sides: client-side gate for UX, presigned-POST `content-length-range` + content-type for enforcement. Types per role policy (decision 9): client = `image/jpeg|png|webp`; owner = those **+ `video/mp4|webm`**.

## Phase 8 — Decommission Cloudinary + docs ✅

- ⬜ Remove `src/lib/cloudinary.ts` and Cloudinary env vars once all callers are migrated and verified.
- ⬜ Remove `res.cloudinary.com` from `next.config.ts` `remotePatterns`.
- ⬜ Update `docs/INFRASTRUCTURE.md`: replace Cloudinary row with Scaleway Object Storage (region, bucket, env, DDL); update the "Supabase Storage (unused)" note.
- ⬜ Update `docs/PLAN.md` and `PROJECT_BIBLE.md` media references.

## Phase 9 — Verification ⬜

- ⬜ Upload (client + admin) → object lands in `private/`, bucket blocks anonymous read.
- ⬜ Role policy holds: client images downscale (no crop) + EXIF-strip before upload; a **client `video/*` presign is rejected (403)**; owner can upload an image **and a demo video**, video renders via `<video>`; oversized files are refused by the presign policy, not just the client gate.
- ⬜ Consent publish → object appears in `public/`, renders via `next/image` public URL.
- ⬜ Presigned GET → private image viewable by owner/authorised client, URL expires.
- ⬜ Erasure → `purgeMediaArtifacts` removes both private and public copies; confirm 404 on the bucket afterward.
- ⬜ *(Only once a service worker exists — none today)* PWA install → uploads/deletes still route through the server; SW does not cache presign calls or presigned URLs; offline upload fails gracefully / queues.
- ⬜ Boot without Scaleway env → app degrades gracefully (`not_configured`), no crash.

---

## Files touched (summary)

| Area | Path | Change |
|------|------|--------|
| New storage module | `src/lib/storage/scaleway.ts` | Scaleway impl of the storage contract |
| Upload route | `src/app/api/media/sign/route.ts` | return presigned PUT params |
| Client upload UI | `src/components/sections/booking-photos.tsx`, `src/components/admin/client-media-section.tsx` | presign → PUT flow |
| Consent | `src/lib/actions/client-consent.ts` | publish/delete via Scaleway |
| Erasure | `src/lib/media-erasure.ts` | delete private + public copies |
| Media inserts | `src/lib/actions/manage-media.ts`, `src/lib/actions/client-media.ts` | write `storage_key` |
| Schema | `supabase/storage-provider.sql`, `src/lib/supabase/types.ts` | add `storage_key`/`storage_provider` |
| Config | `next.config.ts`, `.env.example` | remotePatterns + env names |
| Retire | `src/lib/cloudinary.ts` | remove after cutover |
| Docs | `docs/INFRASTRUCTURE.md`, `docs/PLAN.md`, `PROJECT_BIBLE.md` | update media provider |

## Open questions — resolved

- **Region:** `fr-par` (Paris). French sovereignty, lowest latency to Denmark of the EU regions. `nl-ams` only if a second region is ever wanted. ✅ decided.
- **Public delivery:** raw bucket URL for MVP; revisit a CDN/custom domain (Scaleway Edge Services) only when egress or image weight justifies it. ✅ decided.
- **Migrate existing assets:** **No migration.** Cloudinary keys were never set in prod, so nothing is stored anywhere — the data is disposable. See scope note below.

## Scope note — because there's no live Cloudinary data

The plan is written defensively as if cutting over live data, but Cloudinary never went live (no prod keys, zero stored objects). That lets us **collapse the staged cutover** if desired:

- Phase 5 could **skip the parallel columns** and just repurpose the media rows for Scaleway from the start (still additive is fine — it's cheap insurance and keeps types stable — but the "coexist during cutover" rationale doesn't apply).
- Phase 8 can run **in the same pass**: delete `src/lib/cloudinary.ts`, drop `res.cloudinary.com` from `remotePatterns`, and remove the Cloudinary env vars immediately rather than after a deferred cutover window.
- Net: this is a **clean replace**, not a dual-run migration. Recommend building Scaleway as the only backend and removing Cloudinary in one go.
