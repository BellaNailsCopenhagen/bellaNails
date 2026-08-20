"use client"

import { useCurrentUser } from "@/lib/identity/use-current-user"

/**
 * Client-side conditional rendering by auth state (Supabase session). Render
 * nothing until the session resolves (avoids a signed-out flash of signed-in UI
 * and vice-versa).
 */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser()
  return user ? <>{children}</> : null
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser()
  return !loading && !user ? <>{children}</> : null
}
