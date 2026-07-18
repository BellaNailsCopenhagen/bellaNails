# Bella Nails — Admin PWA Design Brief (integrated prompt)

> **Design produced (July 2026):** this brief was run through Claude Design;
> the result is the strong design direction for the admin build —
> https://claude.ai/design/p/c3b840d8-04b7-4adb-8c48-abb7b51f9c67?file=Bella+Nails+Admin.dc.html
> (import via the `claude_design` MCP, `https://api.anthropic.com/v1/design/mcp`,
> auth `/design-login`; implement `Bella Nails Admin.dc.html`). See the
> "Design source" section in [`../tasks/admin/00-context.md`](../tasks/admin/00-context.md)
> for how implementing tasks should use it. This document remains the
> written spec for states/flows the design file doesn't cover, and the
> prompt to re-run if the design ever needs regenerating.

> Paste this whole document into your design tool (Claude design, Figma
> Make, etc.). It is self-contained: brand system, component vocabulary,
> every screen, every flow, every state. Source of truth for values is the
> live codebase — do not invent new tokens.

---

## 1 · Role and task

You are designing the **owner/admin surface of Bella Nails** — a one-artist
luxury nail studio in Ørestad, Copenhagen. The admin is a **mobile-first
installable PWA**: the artist manages her day from her phone, between
clients, often one-handed. Design phone-first at **390 × 844** (primary),
then 768 (tablet) and 1280 (desktop) as progressive enhancements — the
desktop is the adaptation, never the starting point.

The admin must feel like Bella Nails — the same quiet-luxury editorial
brand as the client site — not like a generic SaaS dashboard. Calm, spare,
confident. No data-dense tables, no chart walls, no exclamation marks.

## 2 · Brand system (exact values — use these, nothing else)

**Colors**
| Token | Hex | Use |
|---|---|---|
| Background (Alabaster) | `#fbfbfa` | page ground |
| Card / Muted | `#f5f3ef` | tinted cards at 60% over background, inputs’ ground |
| Text primary (Onyx ink) | `#1a1a19` | headings, primary text |
| Text secondary | `#66635f` | supporting text, muted heading lines, eyebrows |
| Divider | `#e4e0d9` | hairlines, card borders |
| CTA (Onyx) | `#121212` | primary buttons |
| Destructive | `#8e2c2c` | cancel/danger — always as muted red, often 10% tint bg |
| Success (sage) | `#4a6b52` | confirmed/positive chips — 10% tint bg, 25% border |
| Warning (bronze) | `#96682e` | attention chips (e.g. awaiting reply) — same tint recipe |

**Type**
- **Editorial: Cormorant Garamond** (400/500/600, roman + italic). Display
  headings are TWO lines: dark lead line + second line in text-secondary
  (sometimes italic). Dates on cards use editorial at ~24px.
- **Functional: Plus Jakarta Sans.** Everything else. Eyebrows, buttons,
  labels, captions are UPPERCASE with wide tracking (~0.15–0.35em).
- Scale in use: Display ~56–72 desktop / ~40 mobile · H3 ~20 · Body 16 ·
  BodySm 14 · Caption 11–12 · micro-caption 9–10 (chips, countdowns).

**Shape & space**
- Buttons: **squared** (0 radius), uppercase, tracked. Cards: 8px radius,
  1px `#e4e0d9` border, `#f5f3ef`/60 fill. Rows: 2px radius hover tint.
- Inputs: **underline only** (border-bottom, no box), uppercase caption
  labels above.
- Generous whitespace; hairline separators between sections; content column
  max ~896px centered on desktop.

**Component vocabulary (already exists in code — reuse, don’t redesign)**
- `Button`: onyx solid · outline · ghost · destructive-tint (10% red bg,
  red text) · sizes sm/default/lg.
- `TintedCard`: the universal panel (summary cards, booking cards, notices).
- `Badge` size **xs**: tiny semantic chips (9px, tinted bg + border per
  status color above).
- `AlertDialog`: centered modal for destructive confirms — editorial serif
  title, functional body, right-aligned ghost “Keep it” + destructive
  confirm; backdrop blur; cannot be dismissed while pending.
- Toasts (bottom, quiet) for outcomes: success = plain, error = calm
  guidance (“…call or write the studio”), never blaming.
- `EmptyState`: H3 + one supporting line + a single CTA.
- `Skeleton`: pulsing muted blocks mirroring the real layout.
- `PageHeader`: eyebrow + two-line display heading + supporting intro.
- Status chips (BookingStatusBadge): confirmed/completed = sage,
  rescheduled = bronze, cancelled = muted red.

**Voice**: bilingual da/en (design with the longer string in mind — Danish
often wins). Tone: warm, precise, unhurried. “Din tid er aflyst.” not
“Booking deleted!”.

## 3 · Information architecture

Bottom tab bar on mobile (top tabs ≥768px): **Queue · New · Clients ·
Services · More**. “New” is the centered primary action (studio-created
booking). “More” holds: gallery, testimonials, notifications toggle, deep
links (Meta Business Suite inbox, Cal dashboard, studio Instagram), sign
out. (Clients earned the tab over Gallery: the client book is a between-
appointments daily surface; gallery curation is an occasional sit-down
task.)

## 4 · Screens & flows to design

### A. Queue (home)
- Grouped **Today / Tomorrow / Later**, soonest first. Day headers as
  tracked eyebrows with date in editorial serif.
- **Booking card** (TintedCard): time range (editorial, prominent) +
  live countdown micro-caption top-right · client first name + service ·
  add-ons as small bulleted list · duration + total (price right-aligned,
  editorial) · client note (labelled “YOUR NOTE”-style micro-caption,
  highlighted — allergies live here) · status chip only when it informs
  (rescheduled = bronze; studio cares even though clients don’t see it) ·
  **“AWAITING REPLY” bronze chip + “proposed 2 days ago”** for
  studio-created bookings the client hasn’t accepted.
- Card actions: call / email client (icon-text links), Cancel
  (destructive-tint, opens AlertDialog), acceptance toggle (for proposals).
- States: loading (skeleton cards) · empty day (“Nothing booked — enjoy the
  quiet” tone) · error (calm retry line) · realtime arrival (new card
  slides in with a brief sage highlight, no sound/animation circus).
- A follow-up filter/pill: “Awaiting reply (2)”.

### B. New booking (studio-created) — 4-step flow, one screen each on mobile
1. **Client**: email (required, underline input), name (optional). If email
   matches an existing client, show a quiet “returning client” confirmation
   with their first name.
2. **Treatment**: service picker (rows exactly like the client site’s
   picker: name + duration left, price right, hover/pressed tint), then
   add-on checklist with live total price + duration (reuse the client
   customizer pattern; incompatible add-ons disable with a caption reason).
3. **Time**: date strip + available slots for the computed duration
   (chips/rows, studio timezone). Unavailable days muted.
4. **Review & send**: appointment-summary card (identical anatomy to the
   client’s: service, add-ons, duration, editorial total) + “The client
   receives a confirmation email; the slot is blocked now” note + primary
   CTA **“Book & notify client”**.
- After creation: success state = the new booking card with the bronze
  “awaiting reply” chip, plus a toast. Design the whole flow to be doable
  in under 30 seconds while a client is paying.

### C. Booking proposal lifecycle (states to design explicitly)
- Card: proposed (bronze chip + age) → accepted (chip swaps to quiet sage
  “Confirmed by client” for a beat, then disappears — accepted bookings
  look like any other) → or stale (>48 h: the age caption turns bronze,
  card surfaces in the follow-up filter).
- Manual acceptance toggle: a small labelled switch or tap-target on the
  card (“Client accepted?”) — must be one-thumb reachable, with an undo
  toast.

### D. Services & add-ons (CRUD)
- List: category-grouped rows (name, duration, price; archived ones in a
  collapsed “Archived” section, muted).
- Edit/create sheet or page: **bilingual fields side by side** (EN | DA
  columns collapsing to stacked on mobile with small flag-less “EN/DA”
  captions), price input in kroner, duration stepper (15-min steps),
  add-ons sub-list with the same pattern, incompatibility pairing UI
  (chips: “Nail Art ✕ Extra Massage”).
- **Cal sync status** on each service: quiet caption “Synced with calendar
  ✓” / bronze “Sync pending…” / red “Sync failed — retry”. Archive flow:
  AlertDialog; if upcoming bookings exist, the dialog warns with the count
  (doesn’t block).

### E. Gallery & testimonials
- Gallery: photo grid (3-up mobile), upload FAB/button → the phone’s
  camera roll is the happy path → upload progress state → title fields
  (EN/DA) → optional before/after pairing (two-slot selector) → done.
- **Home slots**: a distinct “Featured on the home page” strip of 5
  numbered slots; drag or tap-to-assign; occupied slots show thumbnails;
  the constraint (max 5, unique) is visible, not a surprise error.
- Testimonials: simple list (quote, author, role), publish toggle,
  add/edit with a single-language quote field (quotes stay as given).
- **Client submissions** surface at the top as a small moderation queue:
  pending cards (quote + chosen credit + which appointment, if any) with
  **Publish / Decline** — decline is quiet, never red (a client’s words
  being unused is not an error). Client-submitted rows show a “from
  client” micro-chip; if the artist edits one, an “edited” marker appears
  (artist-facing only). Empty state: “No new words from clients yet.”

### F. Clients (the studio’s client book)

- **List**: search field at top (underline input, searches name/email).
  Rows: client name (editorial, ~18px) + micro-caption “Last visit 12 Jul ·
  8 visits”. No avatars (we have none — don’t invent placeholder circles;
  a quiet monogram tile in card-tint is acceptable). States: loading
  skeleton rows · empty (“Your client book starts with the first booking”)
  · no-results (“No one matches — check the spelling?”).
- **Client page** (the hero screen of this section):
  - Header: name in editorial display, email + phone as caption lines.
    Action row of three equal touch targets: **Call · Email · New booking**
    (New booking = the primary, onyx; call/email as outline/ghost —
    they leave the app via tel:/mailto:).
  - **Booking history**: upcoming first (same card anatomy as the queue,
    slightly condensed), then past as compact rows with status chips
    (completed sage / cancelled muted red) — the client site’s history
    pattern at admin scale. Past rows carry a quiet **“Ask for a review”**
    action (also available from queue history) → sends a testimonial
    request; already-asked rows show “asked 12 Jul” instead.
  - **Notes**: timestamped entries, newest first; “Add note” opens an
    underline textarea inline. Every entry shows date + edit/archive.
    A permanent quiet caption under the section header: **“Write as if
    the client will read it.”** — this is a legal posture, not decoration;
    it must always be visible, styled as a calm caption, never a warning
    banner.
  - **Photos**: 3-up grid of private reference shots (previous sets).
    Upload tile first (camera-roll happy path, progress state), tap to
    view full-size, optional caption + “from appointment …” link. A quiet
    caption marks the section **“Private — never shown on the site.”**
  - **Photo consent states** (per tile, micro-chip in a corner): none
    (no chip — private is the default, not a status) · “ASKED” bronze ·
    “SHARED” sage (full-size view shows which scopes: website / social) ·
    “DECLINED” muted (no red — a no is not an error) · “WITHDRAWN” muted.
    Full-size view carries the action: **“Ask to feature”** → a small
    sheet with two independent checkboxes (Website gallery / Social
    media, both unchecked), the terms text preview, and “Send request”.
    After sending: the tile chips to ASKED with age (“asked 3 days ago”),
    and a stale request (>7 d) surfaces a gentle re-nudge hint. On
    withdrawal with social granted: a one-time task-like reminder card
    “Remove this from social posts” with a done-checkbox.
    (The client answers on their own /bookings page — image + terms +
    the same two checkboxes + Confirm/Decline, and a permanent “Photos
    you’ve shared” list with one-tap Withdraw. Mirror the card anatomy
    so both sides feel like one system.)
  - **Edit client**: name + phone editable (underline inputs); email
    visibly read-only with the caption “Sign-in identity — can’t change”.
  - **Delete client**: at the very bottom, destructive-tint, opens an
    AlertDialog that states plainly what erasure means (“Removes their
    account, your notes and photos. Past appointments stay as anonymous
    records.”). If upcoming bookings exist, the dialog explains it’s
    blocked until they’re cancelled — disabled-with-reason, not hidden.
- **Cross-links**: tapping the client name on a Queue card opens this
  page; “New booking” here lands in flow B with step 1 pre-filled
  (design the pre-filled state of B1: returning-client confirmation
  shown, fields locked with an “edit” escape).

### G. Notifications & More
- Enable-notifications card: state machine — unsupported browser → “install
  to home screen first” (iOS instructions with the share-sheet glyph) →
  permission prompt → enabled (quiet sage confirmation) → disabled/denied
  (how to re-enable in settings).
- More screen: link list rows (Gallery, Testimonials, Business Suite inbox,
  Cal dashboard, Instagram), account row, sign out (ghost, not
  destructive-red — leaving isn’t dangerous).

### H. Shell states (design once, apply everywhere)
- Auth: non-owner who somehow lands here sees a calm 404-style page.
- Global loading: PageHeader skeleton + content skeletons (never spinners
  alone). Offline: quiet banner “You’re offline — showing the last loaded
  queue”. Push deep-link: opening a notification lands on the queue with
  the target card scrolled-to and briefly sage-highlighted.

## 5 · Interaction principles

- Destructive = always AlertDialog; never a bare button.
- Every failed action produces ONE calm toast with what to do next.
- Disabled-with-reason beats hidden: if an action can’t run, show it
  disabled with a caption saying why (pattern exists: the 24 h policy note).
- Optimistic where safe, honest where not: acceptance toggles flip
  instantly with undo; cancellations wait for the server with a pending
  label (“Cancelling…”).
- Touch targets ≥44px; primary actions in thumb reach (bottom half).

## 6 · Deliverables

1. Mobile screens (390w) for: Queue (all states), New booking (4 steps +
   success + client-prefilled step 1), proposal lifecycle states, Clients
   list + client page (history, notes, photos with all consent-chip
   states, ask-to-feature sheet, edit, erasure dialog), Services list +
   edit, Gallery grid + upload + slots, Testimonials (incl. the
   client-submission moderation queue), Notifications states, More,
   offline/error/empty/loading variants.
   *(The client-facing halves — testimonial form, request prompt card,
   “Photos of your nails” transparency section — live on the client
   site’s /bookings and follow the client site’s existing design system;
   keep the card anatomy consistent so both sides read as one system.)*
2. The 768 and 1280 adaptations for Queue, New booking, Client page,
   Services edit.
3. A component sheet instantiating the vocabulary in §2 at admin sizes
   (booking card anatomy, chips, toggles, tab bar, slot chips).
4. A state matrix page: every chip/status/toast/dialog in one view.
