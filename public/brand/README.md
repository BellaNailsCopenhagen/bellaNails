# Bella Nails — Brand assets

Monochrome identity system. **No gold** — Onyx and Alabaster only, matching the site design tokens.

## Tokens

| Token | Hex | Use |
|---|---|---|
| Onyx | `#121212` | Logo on light backgrounds; default ink. |
| Alabaster | `#FBFBFA` | Logo on dark backgrounds (the `*-reverse` files). |

## Type

- **Plus Jakarta Sans** — the wordmark and all text. Wordmark at weight 300 with wide tracking; "Copenhagen" / labels at weight 400.
- **Cormorant Garamond** — serif voice, used **only** in the BN monogram (italic 500).

SVGs embed these via Google Fonts `@import`, so they render correctly in browsers and on the site (which already loads both families).

## Files & roles

| File | Role | Min size |
|---|---|---|
| `bella-nails-primary.svg` | Primary lockup (wordmark · rule · city) — hero, footer, stamp | ≥ 140px wide |
| `bella-nails-horizontal.svg` | Nav / tight horizontal spaces | ≥ 160px wide |
| `bella-nails-monogram.svg` | Mark — favicon, app icon, avatar | ≥ 24px |
| `*-reverse.svg` | Same, in Alabaster for dark backgrounds | — |
| `../favicon.svg` | Monogram, auto-adapts to light/dark browser UI | — |

## Clear space & usage

- Keep clear space around any lockup equal to the cap height of "Bella" (primary) or the full monogram box height (mark).
- Don't recolor (Onyx/Alabaster only), rotate, stretch, or add effects.
- Use `-reverse` on Onyx (`#121212`) or photography; use the default on Alabaster/light.

## Print / foil / tiny favicons

These SVGs use live `<text>`. For print, foil, embroidery, or sub-16px favicons, **convert text to outlines** (Figma/Illustrator: select → Outline/Flatten) so rendering is font-independent.
