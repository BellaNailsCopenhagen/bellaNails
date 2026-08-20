/**
 * Provider-agnostic identity types. Client-safe (no server/provider imports) so
 * both server and client code can share them.
 */

/**
 * The signed-in user, abstracted from the auth provider. `id` is the current
 * identity key: today the Clerk user id, after the auth cutover the `clients.id`
 * uuid. Callers should treat it as opaque.
 */
export type AppUser = {
  id: string
  isOwner: boolean
  email?: string | null
  name?: string | null
}
