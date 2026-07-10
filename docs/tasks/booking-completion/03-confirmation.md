# Task 03 — /confirmation

> Read [`00-context.md`](./00-context.md) first.

## Goal

The branded post-booking success page. Shows an appointment recap and makes
**"Create an account to manage your bookings"** the hero secondary action
(passwordless — email code / Google / Apple, per the auth model).

## Depends on

- Task 01 (redirects here on Cal success, carrying the booking uid).
- Task 02 (writes the `bookings` row + Clerk user the recap reads from).

## In scope

- New `src/app/[locale]/confirmation/page.tsx` (canonical page pattern) + `src/components/sections/confirmation.tsx`.
- **Recap via DB read** (decided): read the `bookings` row by the Cal **booking uid** passed in the redirect query. Because the webhook is async, the row may lag — implement a **short bounded retry / poll** with a branded loading state; degrade gracefully if it never arrives (see states).
- For **signed-in** clients, render an **optimistic recap immediately** from cached selection/profile context, then reconcile when the row lands.
- Recap content: service (+ add-ons), date/time (localized), duration, total (`PriceTag`), studio address (reuse `FindUs` data/map asset).
- **Account block** via Clerk **prebuilt `<SignUp/>`** (brand-themed) — email code + Google + Apple, no hand-built buttons. Copy: *"Create an account to manage your bookings"* / *"Opret en konto for at administrere dine bookinger"*; sub-copy: reschedule, cancel, rebook in one place; email can be prefilled from the booking. Hide this block entirely when already signed in.
- Primary action "View my bookings" → `routes.bookings`; secondary "Back to home" / "Browse the menu".
- i18n: new `confirmation.*` namespace in `da.json` + `en.json` (incl. `metaTitle`/`metaDescription`).
- `noindex` this page.

## States

- **Signed in** → hide account block; show "View my bookings" directly; recap prefilled.
- **Signed out (default)** → lead with the account block (email prefilled from booking); declining never blocks anything.
- **Just activated here** → swap the block for the "View my bookings" CTA inline (no full reload).
- **Direct hit, no booking context** → don't 404 or look broken; show a generic confirmed state or gently route to `/bookings`.

## Out of scope

- The webhook / row creation (Task 02).
- The `/bookings` page (Task 04) — just link to it.
- Building custom auth UI — use the prebuilt component.

## Acceptance criteria

- After a Task-01 booking, `/da/confirmation?...` shows the correct recap (service, add-ons, time, duration, total) in the booker's locale.
- Recap survives webhook lag (retry covers it) and never renders a broken/empty card.
- Account block appears only when signed out, offers email code + Google + Apple, and successful account creation reflects inline.
- Signed-in visit hides the account block and shows the recap immediately.

## Verification

- E2E scenario steps 5–7 (both locales).
- Simulate webhook lag (delay the row) and confirm the loading→recap transition.
- `pnpm lint` + `pnpm build` green.

## Relevant skills

`clerk-nextjs-patterns/references/server-vs-client.md` (auth state on the page), Clerk prebuilt `<SignUp/>` theming (already configured on `ClerkProvider`).
