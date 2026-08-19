# Tomorrow — action list

Everything below is code that's already shipped; these are the **setup steps only you can do**, plus decisions to confirm.

## 1. Apply migrations (Supabase SQL editor)
- [ ] **`supabase/asset-hub-v2.sql`** — REQUIRED. Adds `client_media.favorited_at` + `media_consents.auto_place`. Until applied: favourites don't persist and bulk auto-place falls back to a plain request (the app degrades safely, no errors).
- [ ] **`supabase/name-uniqueness.sql`** — OPTIONAL hardening. Apply only after checking there are no active duplicate service/add-on names (the file has the check query). Server-side uniqueness already works without it.
- [ ] Confirm already-applied (you said done): `terms.sql`, `price-history.sql`, `service-sections.sql`, `reviews.sql`.

## 2. Content + config (owner)
- [ ] **Footer social links** are placeholders — set real Instagram/Facebook URLs in `src/config/routes.ts` → `externalLinks`.
- [ ] **Final legal text** for `/terms` + `/privacy` — edit in `/admin/terms` (current text is an editable starter draft).
- [ ] **Feature flags** — review `src/config/features.ts`; flip any optional feature off if you don't want it (serviceDetail, serviceGallery, homeShowcase, reviews, testimonials, favorites).

## 3. Test the new asset flows (after step 1)
- [ ] `/admin/assets`: state icons on thumbnails, the **info** legend, favourite stars, the **All** view + state selector, and it opens on **Needs takedown** if any exist.
- [ ] **Add to website gallery** button → preselected candidates, deselect, favourites filter, "Add N to gallery". Consented photos appear on `/gallery`; un-consented get a request that auto-places once the client grants it.
- [ ] A client page → **Gallery** tab: clicking a photo opens the same actions dialog (request / place / favourite).
- [ ] Add a **service section** with an image and confirm it now renders on `/services/[id]` (the embed bug is fixed).

## 4. Phase 11 — retire Clerk + Cal.com (decided: both)
Full design + sequenced plan: **`docs/tasks/in-house/DECISION.md`**. I did **not** execute the swap overnight (it breaks the live app and needs config + testing you must be present for). To kick it off:
- [x] Auth decided: **Google + email one-time-code (passwordless)** via Supabase Auth. **Apple dropped** (paid, not required for a web app); WhatsApp isn't an OAuth login; Facebook a possible later add. Guest bookers keep history (create-or-find a `clients` row by email; later login links by email).
- [ ] Gather prerequisites (much lighter now): a **Google OAuth** client, and the studio's real **working hours** (in-house availability + Insights). Email-OTP needs no external account; point Supabase Auth email at ZeptoMail.
- [ ] Then I'll build it in reviewed, deployable steps — starting with the **provider-agnostic booking + identity function layer** (step 1 is non-breaking), so the actual provider swap is low-risk.

## Notes
- **Vercel token** expired twice this session — a `vercel whoami` refreshes it before `pnpm run deploy:prod` if a deploy 401s.
- **Supabase connector** was disconnected this session, so I couldn't apply migrations for you — hence step 1.
