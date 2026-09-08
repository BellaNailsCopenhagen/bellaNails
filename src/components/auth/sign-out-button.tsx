"use client"

import { signOut } from "@/modules/identity/actions"

/**
 * Sign out + return home. Deliberately has no next-intl dependency, so it is
 * safe in the admin shell, which has no provider — but the label is the
 * caller's to supply rather than hardcoded English, which is how "Sign out"
 * ended up under a Danish header.
 */
export function SignOutButton({
  label,
  className,
}: {
  /** Already localized by the caller (the admin passes English by design). */
  label: string
  className?: string
}) {
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
      {label}
    </button>
  )
}
