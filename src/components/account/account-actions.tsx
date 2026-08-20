"use client"

import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/sections/confirm-action-button"
import { deleteMyAccount } from "@/lib/actions/anonymize-client"
import { signOut } from "@/lib/identity/auth-actions"

/** Sign out + delete account (My space). Delete anonymizes: personal details go,
    bookings stay as required records; published photos need per-item withdrawal. */
export function AccountActions() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={async () => {
          await signOut()
          window.location.assign("/")
        }}
        className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign out
      </button>
      <ConfirmActionButton
        action={async () => {
          const result = await deleteMyAccount()
          if (result.ok) {
            await signOut()
            window.location.assign("/")
          }
          return result
        }}
        trigger={
          <button type="button" className={withdrawPill}>
            Delete my account
          </button>
        }
        labels={{
          title: "Delete your account?",
          body: "We remove your login and personal details (name, email, phone). Your bookings are kept as required records (anonymized). Any photo the studio has published stays unless you withdraw consent for it. This can't be undone.",
          confirm: "Delete",
          confirming: "Deleting…",
          cancel: "Cancel",
          failed: "Couldn't delete — try again.",
        }}
      />
    </div>
  )
}
