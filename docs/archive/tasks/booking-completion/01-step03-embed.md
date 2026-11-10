# Task 01 — Step 03 · Cal.com embed (Confirm)

> **File paths below predate the Aug 2026 restructure.** `src/lib/**` and
> `src/components/sections/` no longer exist; the layers are now `app/`, `modules/`,
> `db/`, `platform/`, `shared/`. This document is kept as a record of the work as it
> was done — for current locations see [architecture.md](../../architecture.md).

> Read [`00-context.md`](./00-context.md) first.

## Goal

Add the missing **Step 03 · Confirm** to the `/book` flow: a themed, inline
Cal.com embed pre-loaded with the chosen service, computed duration, contact
prefill, and a localized notes summary. Enable the currently-`disabled` confirm
button on Step 02 to advance here, and redirect to `/confirmation` on success.

## Depends on

Nothing new — routes and the step-01/02 flow already exist. (End-to-end data
persistence needs Task 02, but Step 03 is independently buildable/testable.)

## In scope

- Install `@calcom/embed-react` (pnpm, project-local).
- New `src/components/sections/booking-embed.tsx` (**client component** — the embed needs the browser). Renders inside the same two-column layout as `BookingAddons`/`BookingDetails`: back link + `BookingSteps current={2}` + `Separator` + `PageHeader` on the left over the embed; `AppointmentSummary` on the right.
- Wire `/book` step routing in `src/app/[locale]/book/page.tsx`: add the `step=confirm` branch (URL `?service=<uuid>&addons=a,b&step=confirm`) rendering the embed section. Follow the existing URL-driven pattern; an unknown/archived service id falls back to the picker (as today).
- In `src/components/sections/booking-details.tsx`: replace the `disabled` confirm button with a link/submit that advances to `?...&step=confirm`, carrying `service` + `addons` in the query.
- Embed config: EU instance (`cal.eu/bellanails/<slug>` via `NEXT_PUBLIC_CALCOM_LINK`), theme `brandColor` Onyx `#121212`, `bodyBg` Alabaster, matching fonts/radii; UI language = active locale.
- Pass into the embed: `?duration=<computed, rounded UP to nearest offered 15-min step>`; prefill `name`/`email`/`phone` from Step 02; **notes** = locale-aware human summary (e.g. `"Klassisk Gelforlængelse (90 min) + French tips (+15 min) · i alt 105 min · 700 kr."`); **metadata** (IDs only) `{ serviceId, addonIds[], totalPriceCents, totalDurationMins, locale }`.
- Duration/price compute helper (reuse the logic behind `AppointmentSummary`; extract to `src/lib/services/` if it isn't already shared) — must handle `addon_incompatibilities` and never under-reserve.
- Optional **account opt-in checkbox** ("Create an account to manage this booking") near the embed — UI only in this task; the actual profile write is Task 02. Wire it as a passthrough flag for now.
- Consent line linking to `/[locale]/terms` (route may 404 until the terms page lands — that's fine; link it now).
- On Cal `bookingSuccessful`, redirect to `/[locale]/confirmation` (locale-aware `redirect`/`router`), preserving the Cal booking uid in the query for Task 03.
- Branded loading skeleton where the embed mounts (no layout shift).
- i18n: add `booking.steps.confirm` already exists — add any new `booking.*` keys (embed heading/intro, consent, account opt-in) to `da.json` + `en.json`.

## Out of scope

- The webhook and DB persistence (Task 02).
- The `/confirmation` page itself (Task 03) — just redirect to it.
- Stripe no-show holds (deferred).
- Building a first-party slot picker — **Cal.com owns availability + date/time**. Do not replicate it.

## Acceptance criteria

- From `/da/book?service=<uuid>` → customise → details → confirm renders the embed with the correct service, computed duration (rounded up), and prefilled contact + notes.
- Embed opens the correct EU event type, shows no duration selector, Danish UI on `/da` and English on `/en`, brand theming applied.
- The summary card on the right matches the totals shown in steps 01/02.
- Successful booking redirects to `/[locale]/confirmation` with locale preserved.
- Back navigation from confirm returns to details with state intact (URL-driven).

## Verification

- Manual walkthrough in both locales (steps 1–4 and 9 of the spec's E2E scenario).
- Confirm computed duration rounds up for an add-on combo that isn't a clean 15-min multiple.
- `pnpm lint` + `pnpm build` green; `/book` still prerenders/handles its states.

## Relevant skills

`clerk-nextjs-patterns/references/server-vs-client.md` (why the embed is a client component). Cal embed config: read `@calcom/embed-react` README in `node_modules` for the current API.
