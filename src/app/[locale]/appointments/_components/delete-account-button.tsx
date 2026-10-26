"use client"

import { useTranslations } from "next-intl"

import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { deleteMyAccount } from "@/modules/clients/anonymize"
import { signOut } from "@/modules/identity/actions"

/** Self-serve account deletion (anonymize): personal data + your uploads go,
    bookings stay as records, studio-published photos need per-item withdrawal. */
export function DeleteAccountButton() {
  const t = useTranslations("account")

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
          {t("deleteCta")}
        </button>
      }
      labels={{
        title: t("deleteTitle"),
        body: t("deleteBody"),
        confirm: t("deleteConfirm"),
        confirming: t("deleteConfirming"),
        cancel: t("deleteCancel"),
        failed: t("deleteFailed"),
      }}
    />
  )
}
