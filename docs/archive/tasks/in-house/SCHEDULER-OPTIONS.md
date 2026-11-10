# Scheduler options — running the timed jobs

Status: **DECIDED — deferred.** The reminder ships as an **admin-triggered "Send
reminders" button** for now (see [ROADMAP.md](ROADMAP.md) item A), so no scheduler
is built yet. Review/testimonial/video-approval requests are admin-triggered too,
so **the reminder is the only future cron candidate**. When volume justifies
automating it, flip the manual route to a daily cron (one-line trigger swap) using
one of the options below. The far-future card-hold placement (CARD-HOLD fork A)
also needs a scheduler when that lands.

The options below stand for when we do automate — Option A (Vercel Cron on Pro)
remains the default; Option B1 (Supabase `pg_cron`) is the free path.

---

The card-hold plan ([CARD-HOLD.md](CARD-HOLD.md)) plus reminders all need something
to run on a schedule. This lays out every option so we can pick one when we do.

## The workload (and why it's forgiving)
Jobs to run on a schedule:
- **Appointment reminders** — to client + artist, ~24 h before (maybe morning-of).
- **Review requests** — a few hours / a day after a completed appointment.
- **Card-hold placement** (CARD-HOLD fork A) — ~2 days before a far-future booking,
  turn the saved card (`SetupIntent`) into an authorization hold.

**Key point: none of these need minute precision.** A once- or twice-daily batch
that "handles everything due in the next window" covers all three. So the choice
is about **cost + reliability**, not granularity. All jobs are low-volume (small
studio) and must: read the DB, send email (Zoho SMTP), and — for holds — call
Stripe.

## The de-risking principle
Build each job as a **secret-protected HTTP route** in the Next app
(`/api/cron/<job>`, guarded by a `CRON_SECRET` header). The route holds the logic
and reuses `modules/`, `db/`, `platform/`. Then **the *trigger* is swappable** —
Vercel Cron, Supabase `pg_net`, or an external pinger all just call that URL. You
can start on the free path and move to Vercel Cron later with a one-line change,
never rewriting the work. This makes the decision low-stakes.

## Option A — Vercel Cron (needs Pro)  ·  simplest
- **How:** a `crons` entry (`vercel.json`) → the `/api/cron/<job>` route; Vercel
  invokes it on schedule. Normal Next server code, full access to our modules.
- **Plumbing:** one route + one config line + a secret. Minimal.
- **Plan / cost:** Hobby is too limited (daily-only, ~2 jobs) **and** is
  non-commercial per Vercel's ToS → a real studio needs **Pro (~$20/mo/member)**.
  Cron compute is negligible within Pro's included allowance.
- **Reliability:** high. Runs in UTC — compute studio-time in code (we have the
  helpers).
- **Pros:** least plumbing, same stack, easy to test/log, reuses all our code.
- **Cons:** the Pro cost — though a commercial site likely needs Pro anyway.

## Option B — Supabase `pg_cron` (+ `pg_net`)  ·  free-capable
- **How:** `pg_cron` schedules a SQL job that uses `pg_net` to `http_post` to an
  endpoint. Two shapes:
  - **B1 (reuse our code):** `pg_net` → POST our `/api/cron/<job>` route. Logic
    stays in the Next app. Simplest reuse.
  - **B2 (fully on Supabase):** `pg_net` → a **Supabase Edge Function** (Deno) that
    does the work. Keeps the scheduler off Vercel, but the email/Stripe logic must
    be **re-implemented in Deno** (duplicates our nodemailer/Stripe code).
- **Plumbing:** enable `pg_cron` + `pg_net`; `select cron.schedule('reminders',
  '0 7 * * *', $$ select net.http_post(url, headers, body) $$)`; plus the endpoint.
  More moving parts than A; the schedule lives in SQL.
- **Plan / cost:** `pg_cron` + `pg_net` are on **Supabase free**; Edge Functions
  free tier is ample. **$0** — *if it stays free*.
- **Reliability caveat:** **free-tier projects pause after ~7 days of inactivity →
  cron stops while paused.** Fine once live with steady traffic; risky pre-launch /
  quiet weeks (a reminder or hold could silently be missed). **Supabase Pro
  (~$25/mo) removes pausing.**
- **Pros:** free; scheduler independent of the Vercel plan.
- **Cons:** more plumbing; pausing risk on free; B2 duplicates logic in Deno;
  harder to test/debug than a plain route.

## Option C — External cron pinging our endpoint  ·  free + decoupled
A free external scheduler hits `/api/cron/<job>` (with the secret) on schedule —
same endpoint as A/B1, so it reuses our code.
- **Upstash QStash** — purpose-built HTTP scheduler, generous free tier (~500
  msgs/day), with **retries + delays** (great for "place the hold 2 days before").
  Most robust free option. Downside: another vendor.
- **cron-job.org / EasyCron** — free, simple, reasonably reliable; just curls the URL.
- **GitHub Actions (scheduled workflow)** — free, but **timing is imprecise** (can
  lag 5–15+ min) and scheduled workflows **auto-disable after ~60 days of repo
  inactivity**. OK for a loose daily reminder, poor for time-sensitive holds.
- **Plan / cost:** $0 within free tiers; Vercel/Supabase plans unaffected.
- **Pros:** free, decoupled, reuses our code.
- **Cons:** a third dependency; reliability varies (QStash best → GitHub weakest).

## At a glance
| Option | Baseline cost | Reliability | Plumbing | New vendor |
| --- | --- | --- | --- | --- |
| **A** · Vercel Cron (Pro) | ~$20/mo (likely needed anyway) | High | Lowest | No |
| **B1** · pg_cron → our route | $0 free / $25 Pro | Med (pauses on free) | Medium | No |
| **B2** · pg_cron → Edge Function | $0 / $25 | Med | High | No |
| **C** · Upstash QStash | $0 | High (retries) | Low–Med | Yes |
| **C** · GitHub Actions | $0 | Low (imprecise) | Low | (GitHub) |

## Recommendation
- **Default — Option A (Vercel Cron on Pro).** The studio is a commercial site, so
  Vercel Pro is the honest baseline anyway; once you're on it, cron is free on top,
  it's the least code, and it reuses everything. Simplest and most reliable.
- **If cost is the hard constraint (stay free) — Option B1** (`pg_cron` → our
  route), accepting the pausing risk: keep the project warm with real traffic once
  live, and upgrade Supabase to Pro only if a missed reminder ever bites. Avoid B2
  (Deno duplication).
- **If you want free + robust without Vercel Pro — Option C with Upstash QStash**,
  accepting one extra vendor (against the minimal-stack preference).

Whichever we pick, the jobs are the same swappable `/api/cron/<job>` routes — so
this is reversible, and we can start free and graduate to Vercel Cron with a
one-line change.
