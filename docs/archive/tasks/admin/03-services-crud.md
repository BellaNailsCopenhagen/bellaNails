# Task 03 — Services & add-ons CRUD + Cal sync

> Read [`00-context.md`](./00-context.md) first. Depends on Task 01.

## Goal

The owner manages the catalog (categories, services, add-ons, prices,
durations, incompatibilities) herself — and Cal event types stay in sync
automatically, including duration options. This retires the whole class of
manual-PATCH bugs (the 60-vs-75 under-reservation incident).

## In scope

- CRUD for `categories` / `services` / `addons` (+ `addon_incompatibilities`
  pairs) — bilingual name/description fields side by side (`_en`/`_dk`),
  prices in cents via a kroner input, soft-delete via `archived_at` (never
  hard-delete; history depends on rows surviving).
- **Cal event-type sync** (server actions, owner-verified):
  - Create service → create Cal event type (API v2, version `2024-06-14`):
    slug, title, `lengthInMinutes` = base duration; store `cal_event_id` +
    `cal_event_slug` on the row.
  - On ANY change to a service's base duration, its add-ons' durations, or
    incompatibility pairs → recompute the reachable slot set (base +
    every compatible add-on combination, rounded UP to 15) and PATCH
    `lengthInMinutesOptions`. One shared `computeSlotOptions(service,
    addons, pairs)` — property: every combination the customizer can
    produce MUST be in the options list (this is the invariant the July
    incident violated).
  - Archive service → archive/hide the Cal event type.
- Guardrails: slug uniqueness, warn before archiving a service with
  upcoming bookings (query, don't block).
- Replace the `test-*` slugs flow: creating the real production services
  through this UI is the launch path.

## Out of scope

- Availability/schedule management (Cal dashboard remains the tool).
- Stripe/no-show holds (deferred, per PLAN).

## Acceptance criteria

- Create a service with two add-ons and one incompatibility → Cal event
  type exists with exactly the computed options; book it end-to-end on the
  client site with an add-on and the calendar blocks the rounded-up slot.
- Change an add-on's duration → options PATCH fires; the webhook's
  "slot shorter than treatment" guard stays silent on the next booking.
- Archived service disappears from client surfaces (RLS already enforces),
  history rows still render with the fallback label.
