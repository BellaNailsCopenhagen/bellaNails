"use client"

import { signOut } from "@/modules/identity/actions"

/** Sign out + return home. Locale-free, so it's safe in the admin shell (which
    has no next-intl provider) as well as the client surfaces. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut()
        window.location.assign("/")
      }}
      className={
        className ??
        "font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      Sign out
    </button>
  )
}
