/**
 * Who the caller is, and whether they may act. Every module that authorizes
 * something goes through `getCurrentUser` (the person) or `requireOwner` (the
 * studio), so there is one definition of each.
 *
 * **Client components must not import this** — it reads cookies. They use the
 * `useCurrentUser` hook and `./actions`.
 */
export { getAuthUser, getCurrentUser } from "./server"
export { requireOwner } from "./require-owner"
export { isOwnerUser } from "./owner"
export { ensureUser } from "./ensure-user"
export { signOut } from "./actions"
export type { AppUser } from "@/shared/app-user"
