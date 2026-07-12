# Test-phase deployment (Vercel CLI, personal Hobby account)

The repo lives under a GitHub organization, so Vercel's free plan refuses the
Git integration. For the test phase we deploy with the **Vercel CLI** instead —
it uploads the local working tree directly and never talks to GitHub. One
command per deploy, no plumbing. At launch we switch to Vercel Pro and connect
the org repo properly (auto-deploys, preview URLs per PR).

> **Rule of thumb for the whole test phase:** Cal.com is the source of truth
> for bookings. Supabase + Clerk are mirrors maintained by our webhook. When
> something looks missing, check the chain in this order:
> Cal delivery log → Vercel function logs → Supabase row → Clerk user.

---

## Phase 0 — before the first deploy (one-time)

- [ ] Review + merge `feat/booking-webhook-identity` (webhook, identity, all
      review fixes). Deploy from `main` so the deployed code matches a commit.
- [ ] In `.env.local`: `NEXT_PUBLIC_CALCOM_LINK=bellanails` — **username
      only**, no `/session` suffix, or every embed link breaks.
- [ ] Have secret values at hand: Supabase (URL, anon key, service-role key),
      Clerk (publishable + secret, dev instance), Cal webhook secret.
- [ ] Cal.com dashboard: each of the 5 test event types has an **availability
      schedule** attached (no schedule = embed shows no slots).
- [ ] Clerk dashboard (dev instance): Google + Apple sign-in enabled,
      verified-email account linking on, phone = optional identifier.

## Phase 1 — create the Vercel project (one-time)

```bash
pnpm dlx vercel login    # personal account (not the org)
pnpm dlx vercel link     # from repo root → create project, e.g. "bella-nails"
```

Then in the Vercel dashboard → project → **Settings → Environment Variables**,
add to the **Production** environment:

| Key | Value / note |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` for now |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — webhook writes need it |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` (dev instance is fine for testing) |
| `CLERK_SECRET_KEY` | `sk_test_…` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/da/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/da/sign-up` |
| `NEXT_PUBLIC_CALCOM_LINK` | `bellanails` (username only) |
| `CALCOM_WEBHOOK_SECRET` | must equal the secret set on the Cal webhook |
| `CALCOM_API_KEY` | optional for now (not read by deployed code yet) |

Cloudinary keys: skip — nothing in `src/` reads them yet.

## Phase 2 — first deploy + smoke test

```bash
pnpm dlx vercel --prod
```

Use the **stable alias** `https://<project>.vercel.app` (not the per-deploy
hash URL) everywhere below — it survives redeploys.

- [ ] `/da` and `/en` render; language switch works.
- [ ] `/services` menu renders from Supabase (proves anon DB access works).
- [ ] `/book` → pick service → add-ons → details → confirm: the Cal embed
      loads with the right event, duration and prefilled contact.
- [ ] `curl -X POST https://<project>.vercel.app/api/webhooks/cal` returns
      **401** (unsigned request rejected — proves the route is live and the
      secret check runs).

> Preview deploys (`vercel` without `--prod`) sit behind Vercel Authentication
> by default — Cal's webhook can't reach them. Always test webhooks against
> the production deployment.

## Phase 3 — point Cal.com at the deployment (one-time)

In Cal → Settings → Developer → **Webhooks**:

- [ ] Subscriber URL: `https://<project>.vercel.app/api/webhooks/cal`
- [ ] Secret: identical to `CALCOM_WEBHOOK_SECRET` on Vercel.
- [ ] Events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`.
- [ ] Webhook enabled; use Cal's "ping/test" button if offered and check the
      Vercel function logs for the hit.

## Phase 4 — the test round

Use a real email you can receive. After each step, check the chain:
Supabase `bookings` row → Clerk user → Vercel logs.

1. [ ] **Happy path ×2 (da + en):** full flow, pick a slot. Expect: Cal email
       with the localized notes summary; Supabase row `confirmed` with correct
       service/add-on IDs, price, duration; Clerk user with email/name/phone.
2. [ ] **Slot rounding:** book a combo crossing a 15-min boundary (e.g.
       60 + 20 = 80 → 90-min slot). The calendar block must round **up**.
3. [ ] **Reschedule** via the link in Cal's email → **new** row `rescheduled`,
       old row flipped to `cancelled`. (Trickiest webhook path — only verified
       with replays so far; this is the real-payload check.)
4. [ ] **Cancel** via the email link → row `cancelled`.
5. [ ] **Same email again** → no duplicate Clerk user; profile not clobbered.
6. [ ] **Signed-in booking:** sign in → details prefilled → book → row keyed
       to the same Clerk user id.
7. [ ] **Hostile URLs:** incompatible add-on pair crafted in the URL is
       dropped; `step=confirm` without contact params falls back to details.
8. [ ] **Post-booking redirect:** lands on `/confirmation` — **404 until
       Task 03 is built**; expected if testing before that.

## Phase 5 — iterating during the test phase

### The `deploy` branch is the source of truth

`vercel --prod` uploads the **working tree**, not a git ref — Vercel has no
Git integration on this plan, so branch discipline lives on our side:

- `deploy` branch = exactly what runs in production. Never commit to it
  directly; only fast-forward reviewed work into it.
- `scripts/deploy.sh` (run as `pnpm run deploy:prod`) refuses to deploy unless
  you are **on `deploy` with a clean tree**, then runs `vercel --prod`.

```bash
git checkout deploy
git merge --ff-only main   # or the reviewed feature branch
pnpm run deploy:prod
```

When we move to Vercel Pro + Git integration at launch, this maps 1:1 — set
"Production Branch" to `deploy` in Vercel and pushes to it deploy themselves.

- Change → review → merge into `deploy` → `pnpm run deploy:prod` (~2 min). The
  stable alias and the Cal webhook keep working, no re-wiring.
- Logs: dashboard → project → Deployments → Functions, or `pnpm dlx vercel logs <url>`.
  Every deliberate skip/failure in the webhook logs a `console.error`.
- Signed webhook replays can be pointed at the deployed URL for regression
  checks without creating real bookings (scripts to be committed under
  `scripts/`).
- Cleanup after the round: cancel test bookings in Cal, delete test rows in
  Supabase and test users in Clerk.

## Out of scope for the test phase (launch tasks)

- Vercel Pro + org-repo Git integration (auto-deploys, PR previews).
- Clerk production instance keys + custom domain.
- Real Cal event types replacing the `test-*` slugs.
- `NEXT_PUBLIC_SITE_URL` → `https://bellanails.dk`, domain + DNS.
