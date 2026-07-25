# Bella Nails — Local SEO Plan

**Goal:** Rank for high-intent local searches — above all **"neglesalon Ørestad"** and **"neglesalon Bella Kvarter"** — and pull steady traffic/bookings from the Ørestad/Amager local market.

**Location:** Halldór Laxness Vej 3, 2. th, 2300 København S (Ørestad, by Bella Kvarter, Amager).

---

## 1. The core tension (and how we resolve it)

The brand is intentionally minimal and "quiet luxury" — the live page shows *"Where Craft Becomes Art,"* *"The Curation Studio,"* and a placeholder *"THE LOGO."* Beautiful, but a search engine sees no "nail salon," no "Ørestad," no "København." Search can't rank what isn't on the page.

We don't fix this by cluttering the design. We put keywords where **crawlers read but visitors barely notice**: the title tag, meta description, the real `<h1>`, image alt text, structured data (schema), the footer NAP block, and one or two natural sentences in the About/Contact copy. The poetic headlines stay; we add a small keyworded "eyebrow" line and let the service names and footer do the SEO work.

---

## 2. Keyword map (best words, prioritized)

### Tier 1 — Primary (Danish, local intent — own these first)

| Keyword | Why |
|---|---|
| **neglesalon Ørestad** | Your #1 target. Low competition, exact-match intent. |
| **neglesalon Bella Kvarter** | Hyper-local, almost no competition, brand-name synergy. |
| **negleklinik Ørestad** | "Negleklinik" is the other common Danish term for the same thing — capture both. |
| **neglesalon København S / 2300** | Postal-area intent. |

### Tier 2 — Service + location (Danish)

`shellac Ørestad` · `shellac København` · `gel negle Ørestad` · `geleforlængelse København` · `BIAB negle København` · `manicure Ørestad` · `luksus neglesalon København`

### Tier 3 — English (for the international Ørestad/Bella Kvarter residents)

`nail salon Ørestad` · `nail salon Copenhagen` · `gel nails Copenhagen` · `shellac Copenhagen` · `luxury nail salon Copenhagen`

### Tier 5 — Product / trust differentiators (rivals rarely rank for these)

`HEMA-free neglesalon` · `vegansk neglesalon København` · `fiberglas negle København` · `gel til tynde/skøre negle` · `neglestyrkende behandling` · `Didier Lab København` · EN: `HEMA-free nails Copenhagen`, `vegan nail salon Copenhagen`, `nails for weak/brittle nails`

### Tier 4 — Long-tail (low volume, high conversion → great for FAQ + blog)

`neglesalon nær Bella Center` · `bedste neglesalon Amager` · `tidsbestilling neglesalon Ørestad` · `hvad koster shellac København` · `forskel på shellac og gellak`

### Danish service vocabulary to use consistently
- **Geleforlængelse / gelenegle** (your "Classic Gel Extension")
- **Klassisk manicure** (your "Classic Manicure")
- **Shellac / BIAB** (builder gel — strukturel forstærkning)
- Supporting: **gellak, akrylnegle, neglebehandling, pedicure**

> Note on synonyms: Danes search both **"neglesalon"** and **"negleklinik."** Use "neglesalon" as the main term (brand/title) and work "negleklinik" into body copy/FAQ so you rank for both.

---

## 3. On-page integration — section by section

Mapped to the page as it exists today. (Code snippets in §4 are proposals to approve before I implement.)

1. **Nav logo** — replace `THE LOGO` with a **"Bella Nails"** text wordmark. Your brand name is itself a keyword; don't ship it as an image with no alt text.
2. **`<title>` + meta description** — per locale (see §4). This is the single highest-leverage on-page change.
3. **Hero** — keep *"Where Craft Becomes Art."* Add a small kicker line above it: **"Neglesalon i Ørestad · København"** and make the semantic `<h1>` carry the keyword (the poetic line can be a styled span). Crawlers get the keyword; the look is unchanged.
4. **Services ("A Selection of the Studio's Best")** — add Danish service names as the localized titles: *Geleforlængelse*, *Klassisk Manicure*, *Shellac / BIAB*. Descriptions naturally mention the service terms.
5. **About ("Nails as a medium")** — add one grounded sentence: *"…en intim neglesalon i hjertet af Ørestad, ved Bella Kvarter på Amager."*
6. **Contact / footer** — full **NAP** (Name, Address, Phone) as crawlable text, identical everywhere, plus an "areas served" line: *Ørestad · Bella Kvarter · Amager · Islands Brygge · Kastrup.*
7. **Image alt text** — every gallery image: e.g. `alt="Geleforlængelse hos Bella Nails – neglesalon i Ørestad"`. Free, relevant, currently empty.
8. **New: FAQ section** — 5–6 Q&As targeting long-tail + powering FAQ schema. E.g. *"Hvor ligger Bella Nails?"*, *"Hvad koster shellac?"*, *"Kan jeg bestille tid online?"*, *"Hvad er forskellen på shellac og BIAB?"*, *"Er jeres gel HEMA-fri / vegansk?"*
9. **"The Formula" section (Didier Lab)** — names the product brand + trust chips (HEMA-free, vegan, cruelty-free, fiberglass, Vitamin E + calcium) in crawlable text; targets the Tier-5 differentiator terms rivals don't have. Good candidate for a `Product`/`Brand` mention and an FAQ entry on HEMA-free/vegan.

---

## 4. Technical SEO (proposed code — approve before I apply)

### 4.1 Per-locale metadata (Next.js App Router + next-intl)

```ts
// proposed: src/app/[locale]/page.tsx (or layout) — values pulled from messages/*.json
// da
title: "Bella Nails – Neglesalon i Ørestad, København S | Shellac, Gel & BIAB"
description: "Bella Nails er en intim neglesalon i Ørestad ved Bella Kvarter. Geleforlængelse, klassisk manicure, Shellac og BIAB. Book tid online."
// en
title: "Bella Nails – Nail Salon in Ørestad, Copenhagen | Shellac, Gel & BIAB"
description: "Bella Nails is an intimate nail salon in Ørestad by Bella Kvarter, Copenhagen. Gel extensions, classic manicure, Shellac & BIAB. Book online."
```

### 4.2 hreflang + canonical (via Next metadata `alternates`)

- `da` (default) and `en`, plus `x-default`.
- Self-referencing canonical per locale (each version has unique translated content).
- Map URL keys to ISO codes explicitly (`/da` → `da`, `/en` → `en`) — >60% of multilingual sites misconfigure hreflang.

### 4.3 LocalBusiness / NailSalon JSON-LD (the single biggest on-page lever for local)

```json
{
  "@context": "https://schema.org",
  "@type": "NailSalon",
  "name": "Bella Nails",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Halldór Laxness Vej 3, 2. th",
    "postalCode": "2300",
    "addressLocality": "København S",
    "addressCountry": "DK"
  },
  "areaServed": ["Ørestad", "Bella Kvarter", "Amager", "København S"],
  "geo": { "@type": "GeoCoordinates", "latitude": "__", "longitude": "__" },
  "openingHours": "Mo-Sa 09:00-18:00",
  "priceRange": "$$",
  "telephone": "+45 __ __ __ __",
  "url": "https://__",
  "sameAs": ["https://instagram.com/__", "https://facebook.com/__", "<Google Business Profile URL>"]
}
```

(Add `FAQPage` schema on the FAQ section.)

### 4.4 Plumbing
- **Sitemap** with hreflang annotations + **robots.txt** (Next can generate both).
- **Core Web Vitals** — the dark hero is large; store a pre-sized/compressed asset (Scaleway has no on-the-fly transforms), use `next/image` with `priority`, and keep it mobile-fast. Speed is a local ranking factor.

---

## 5. Off-page — where the real local traction is

On-page gets you eligible to rank; **GBP + reviews get you into the local pack.**

### 5.1 Google Business Profile (do this first, in parallel with on-page)
- Create/claim the profile. **Primary category: "Nail salon" (Neglesalon)** — the single biggest GBP ranking factor.
- NAP **exactly** matching the website (same street format, same phone).
- Add services + prices, real photos, opening hours, and the **Cal.com booking link**.
- Post regularly (offers, new sets) — Google rewards active profiles.

### 5.2 Reviews (highest-leverage ongoing activity)
- 87% of consumers read reviews; **velocity, count, and your response rate** all rank.
- Ask **every** client — QR code at checkout + a post-visit SMS/email (wire into the Cal.com booking flow).
- **Respond to ≥80% of reviews** (measurable ranking boost). Reply in the language the review was written in.

### 5.3 Citations / directories (consistent NAP everywhere)
Krak.dk, De Gule Sider, Trustpilot, Facebook, Instagram, Apple Maps, Bing Places, and Danish booking directories (e.g. Booksy). Identical name/address/phone on each.

### 5.4 Local content (Danish blog → long-tail + internal links to booking)
- *"Shellac vs. gellak — hvad er forskellen?"*
- *"Sådan passer du på dine gelenegle"*
- *"Neglesalon i Ørestad: derfor er Bella Nails anderledes"*

### 5.5 Local links & social
- Partnerships/listings with Ørestad community sites, Bella Center / Bella Sky, local Amager/Ørestad Facebook groups, DR Byen.
- Instagram with geotags + hashtags: `#neglesalonkøbenhavn #ørestad #amagernegle #bellakvarter`.

---

## 6. Prioritized rollout

**Phase 0 — On-page (this sprint):** wordmark, per-locale title/meta, keyworded H1 + hero kicker, footer NAP + areas served, LocalBusiness schema, hreflang/canonical, image alt text, FAQ section.

**Phase 1 — Local presence (week 1–2):** claim & fully optimize Google Business Profile; submit core citations with consistent NAP; build the review-request flow into Cal.com.

**Phase 2 — Ongoing:** publish 1 Danish blog post/month; pursue 3–5 local backlinks; post weekly on GBP + Instagram; respond to every review.

**Measure:** Google Search Console (queries + position for the Tier-1 terms), GBP insights (calls, direction requests, booking clicks), and local-pack position for "neglesalon Ørestad."

---

## 7. Open items to confirm
- Public **phone number** and final **domain** (needed for NAP + schema).
- Exact **geo coordinates** for the schema.
- **Social profile URLs** (for `sameAs` + citations).
- Confirm opening hours (page shows Mon–Sat 09:00–18:00, by appointment).
