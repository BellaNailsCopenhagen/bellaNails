# Exploration — Social media integration (nice to have)

> Status: **DROPPED (owner, July 2026).** Unified inbox = Meta Business
> Suite (free, official) — we deep-link, never build. "Share to Instagram"
> from the gallery also dropped: unlikely to be used enough, and it would
> mean storing post-only data the site never shows — wasted space. What
> ships instead: **rich sharing metadata** (Open Graph / Twitter cards +
> branded OG image) so the site looks great when CLIENTS share it on
> social/messaging apps. Kept below for the reasoning record.

## The honest assessment

**Money-free ≠ cost-free.** Meta's APIs (Instagram + Facebook messaging,
publishing, comments) charge nothing — but building a unified inbox in our
admin requires: a Meta developer app with **business verification and App
Review** (weeks, per-permission approval for `instagram_manage_messages`,
`pages_messaging`, `pages_manage_posts`), webhook infrastructure for
incoming DMs, token refresh maintenance forever, and compliance with
messaging-window policies that Meta changes at will. TikTok has **no DM API
at all**. For a one-artist studio this is a permanent maintenance liability
attached to our codebase for something that already exists:

**→ Recommendation: the artist uses the official Meta Business Suite app
(free) as the unified inbox** — Instagram DMs + Facebook Messenger +
comments on both, plus post scheduling across both platforms, in one app,
maintained by Meta. We add one-tap deep links to it from the admin shell so
it FEELS like part of the workflow. Zero build, zero review, zero breakage
risk.

## What IS worth building (our genuine angle)

- ⬜ **"Share to Instagram" from the gallery admin (Task 04 synergy).**
  When the artist uploads a finished set, one tap cross-posts it to the
  business IG account via the Content Publishing API. This is ONE-WAY
  publishing: a single permission scope, much lighter review than
  messaging, business IG account required (she needs one anyway). The
  photo workflow becomes: shoot → gallery upload → site updated → IG
  posted — one motion. This is the piece with real leverage.
- ⬜ **Instagram feed on the public site** (gallery/footer enrichment):
  embed latest posts via Meta's oEmbed. Light, but adds a maintenance
  token; evaluate against just curating the gallery manually (which we
  fully control and is already the plan).
- ✅ (trivial, do with admin Task 01) Deep links in the admin shell to
  Business Suite inbox + the studio's IG/FB profiles.

## Questions to answer before committing

1. Is the studio Instagram a **professional (business) account** linked to
   a Facebook Page? (Hard requirement for every API path above.)
2. Does the artist already live in Business Suite? If yes, the inbox
   problem is already solved — only the publish-from-gallery piece remains
   interesting.
3. Is the review burden of the publishing permission acceptable for the
   value? (One-time, but real.)

## Non-goals

- Building/hosting a DM inbox, auto-replies, or a social scheduler — Meta
  Business Suite and (if ever needed) free tiers of Buffer/Later own this
  space. Our codebase stays out of the moderation/messaging business.
