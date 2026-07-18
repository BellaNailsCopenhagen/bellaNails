/**
 * Owner-role authorization — the single source of truth for "is this session
 * the studio owner?". Reused by the `/admin` proxy gate now and by every admin
 * server action later (the UI is never the boundary; each mutation re-checks).
 *
 * The role lives in the Clerk **session token** under `metadata.role`, mapped
 * from `user.public_metadata.role` in the Clerk dashboard:
 *
 *   Dashboard → Sessions → Customize session token:
 *     { "metadata": { "role": "{{user.public_metadata.role}}" } }
 *
 * The same claim path backs the Supabase `Owner reads all bookings` RLS policy
 * (`auth.jwt() -> 'metadata' ->> 'role'`), so keep them in sync. The claim is
 * typed via the `CustomJwtSessionClaims` augmentation in `src/global.d.ts`.
 */
export const OWNER_ROLE = "owner"

export function isOwner(
  sessionClaims: CustomJwtSessionClaims | null | undefined,
): boolean {
  return sessionClaims?.metadata?.role === OWNER_ROLE
}
