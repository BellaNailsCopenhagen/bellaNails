/**
 * Owner-role authorization — the single source of truth for "is this the studio
 * owner?". Reused by the `/admin` proxy gate and by every admin server action
 * (the UI is never the boundary; each mutation re-checks via requireOwner).
 *
 * The role lives in the Supabase user's `app_metadata.role`
 * (server-set, not user-editable), which also backs the
 * `auth.jwt() -> 'app_metadata' ->> 'role' = 'owner'` RLS policies — keep them
 * in sync. Set once per owner:
 *   update auth.users set raw_app_meta_data =
 *     raw_app_meta_data || '{"role":"owner"}'::jsonb where email = '<owner>';
 */
export const OWNER_ROLE = "owner"

type WithAppMetadata =
  { app_metadata?: Record<string, unknown> | null } | null | undefined

export function isOwnerUser(user: WithAppMetadata): boolean {
  return user?.app_metadata?.role === OWNER_ROLE
}
