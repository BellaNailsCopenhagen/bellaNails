"use client"

import { signOut } from "@/lib/identity/auth-actions"
import { useCurrentUser } from "@/lib/identity/use-current-user"

/**
 * Minimal signed-in control: an initial + Sign out. Replaces Clerk's
 * `<UserButton>`. Renders nothing when signed out.
 */
export function AccountMenu() {
  const { user } = useCurrentUser()
  if (!user) return null

  const initial = (user.email ?? "?").charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-2">
      <span
        title={user.email ?? ""}
        className="flex size-8 items-center justify-center rounded-full border border-border font-functional text-xs uppercase text-foreground"
      >
        {initial}
      </span>
      <button
        type="button"
        onClick={async () => {
          await signOut()
          window.location.assign("/")
        }}
        className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  )
}
