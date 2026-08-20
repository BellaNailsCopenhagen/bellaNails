"use client"

import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/sections/confirm-action-button"
import { anonymizeClient } from "@/modules/clients/anonymize"

/**
 * Owner control to fulfil a client's erasure request: anonymize (scrub PII,
 * remove login, delete their own unused uploads) while keeping bookings +
 * artist-owned media. Confirm-guarded; irreversible.
 */
export function EraseClientButton({ clientId }: { clientId: string }) {
  return (
    <ConfirmActionButton
      action={() => anonymizeClient(clientId)}
      trigger={
        <button type="button" className={withdrawPill}>
          Erase client data
        </button>
      }
      labels={{
        title: "Erase this client's personal data?",
        body: "Removes their login and personal details (name, email, phone) and deletes their own unused uploads. Bookings, consents, and any photo the studio has published stay (kept anonymized / studio-owned). This can't be undone.",
        confirm: "Erase",
        confirming: "Erasing…",
        cancel: "Cancel",
        failed: "Couldn't erase — try again.",
      }}
    />
  )
}
