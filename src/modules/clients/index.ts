/**
 * The people the studio knows: contact resolution, the profile a client edits,
 * and GDPR erasure.
 *
 * **Client components must not import this** — they import `./actions` and
 * `./anonymize` directly (both are `"use server"`).
 */
export { fetchClientContacts } from "./contacts"
export { updateMyProfile, type ProfileResult } from "./actions"
export {
  anonymizeClient,
  deleteMyAccount,
  type AnonymizeResult,
} from "./anonymize"
export { contactDisplayName, type ClientContact } from "@/shared/contact"
