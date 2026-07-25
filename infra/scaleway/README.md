# Scaleway Object Storage — setup runbook

Backs the media storage migration ([../../docs/tasks/storage-scaleway-migration.md](../../docs/tasks/storage-scaleway-migration.md)).
Bucket `bellanails-media`, region `fr-par`, endpoint `https://s3.fr-par.scw.cloud`.

Done entirely in the **Scaleway console** (keeps it off any existing `aws` CLI
profile). The JSON files here are what you paste.

## 1. Create the bucket

Object Storage → **Create bucket** → name `bellanails-media`, region **Paris
(fr-par)**, visibility **Private**.

`private/` and `public/` are **key prefixes, not folders** — they appear the
moment objects are written. Nothing to pre-create.

## 2. Public delivery — per-object ACL, NOT a bucket policy

⚠️ **Do not set a bucket policy.** On Scaleway a bucket policy becomes the sole
authority for the bucket and will **lock your own key out** (AccessDenied on
list/CORS/put) unless it also grants your principal — we hit exactly this.
Instead the app sets `ACL: public-read` on each published copy (`publishToPublic`),
so `public/*` objects are anonymously readable while the bucket stays Private.
`bucket-policy.json` is kept only as a reference for the rejected approach — do
not apply it. (If a policy ever got applied and locked you out:
`aws … s3api delete-bucket-policy --bucket bellanails-media`.)

## 3. API key — console

IAM → **API keys → Generate** (with Object Storage access). The **secret is
shown once** — paste both values into `.env.local` below.

## 4. CORS — S3 API only (no console UI on Scaleway)

CORS is required for browser uploads (cross-origin `PUT/POST`). Scaleway has no
console screen for it, so set it via a **dedicated, isolated `aws` profile** —
this does NOT touch any existing default/work profile:

```sh
aws configure --profile scaleway         # Scaleway access+secret key, region fr-par, json
aws --profile scaleway --endpoint-url https://s3.fr-par.scw.cloud \
    s3api put-bucket-cors --bucket bellanails-media \
    --cors-configuration file://infra/scaleway/cors.json
# verify:
aws --profile scaleway --endpoint-url https://s3.fr-par.scw.cloud \
    s3api get-bucket-cors --bucket bellanails-media
```

## Verify (browser or curl)

After uploading one test object under each prefix:

```sh
curl -s -o /dev/null -w "private: %{http_code}\n" https://bellanails-media.s3.fr-par.scw.cloud/private/anything  # expect 403
curl -s -o /dev/null -w "public:  %{http_code}\n" https://bellanails-media.s3.fr-par.scw.cloud/public/<test>     # expect 200
```

## .env.local (you add; secrets never committed)

```
SCALEWAY_ACCESS_KEY=<access key>
SCALEWAY_SECRET_KEY=<secret key>
SCALEWAY_REGION=fr-par
SCALEWAY_ENDPOINT=https://s3.fr-par.scw.cloud
SCALEWAY_BUCKET=bellanails-media
NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL=https://bellanails-media.s3.fr-par.scw.cloud
```

## Notes

- If Scaleway rejects `"Principal": "*"` in the policy, use `"Principal": {"SCW": "*"}`.
- Swap `REPLACE-WITH-PROD-DOMAIN` in `cors.json` once the prod domain exists, then re-run `put-bucket-cors`.
