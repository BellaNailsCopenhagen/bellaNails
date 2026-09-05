/**
 * The business's own identity — the details that are ITS, not the app's: where
 * to reach it, which addresses its mail leaves from, and where it is online.
 *
 * Named for the business rather than the studio on purpose: nothing here is
 * specific to a nail salon, and a name that assumes one is a name that has to
 * be rewritten the day it serves anything else.
 *
 * **Client components must not import this** — it is transitively
 * `server-only`. They import `./profile-actions` and the `@/shared/*` types.
 */
export { getBusinessProfile, getBusinessProfileForAdmin } from "./profile"
// Re-exported for server callers; client components import ./profile-actions
// directly, and `components/**` must deep-import either way (it may not touch a
// barrel — see AGENTS.md).
export {
  clearBusinessMapImage,
  saveBusinessProfile,
  setBusinessMapImage,
} from "./profile-actions"
