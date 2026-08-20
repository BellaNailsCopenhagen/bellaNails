"use client"

import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/sections/confirm-action-button"
import { deleteMyAccount } from "@/modules/clients/anonymize"
import { signOut } from "@/modules/identity/actions"

/** Self-serve account deletion (anonymize): personal data + your uploads go,
    bookings stay as records, studio-published photos need per-item withdrawal. */
export function DeleteAccountButton() {
  return (
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
        body: "This removes your login and personal details, and deletes any photos you uploaded that the studio isn't using. Your bookings are kept as required records (anonymized). Photos the studio has published to its website or social media stay — you can withdraw consent for those and we'll remove them from public view as soon as possible. This can't be undone.",
        confirm: "Delete",
        confirming: "Deleting…",
        cancel: "Cancel",
        failed: "Couldn't delete — try again.",
      }}
    />
  )
}
