"use client"

import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { CalEmbedShell } from "@/components/sections/cal-embed-shell"
import type { BookingContact } from "@/shared/contact-validation"
import { settleBookingRow } from "@/shared/booking-probe"
import { routes } from "@/config/routes"

/** IDs-only machine payload the webhook/sync persist — never parsed as text. */
type BookingMetadata = {
  serviceId: string
  addonIds: string[]
  totalPriceCents: number
  totalDurationMins: number
  locale: string
  /** The client's own session note (Cal metadata values cap at 500 chars,
      matching the form's maxLength). */
  clientNotes?: string
}

/**
 * BookingEmbed — the inline Cal.com booker, pre-configured with the computed
 * slot length, contact prefill, the localized notes summary, and metadata.
 * On success: settle our row (sync-first, capped), then replace-navigate to
 * /confirmation so back can't resurface the armed confirm step.
 */
export function BookingEmbed({
  calLink,
  slotMins,
  prefill,
  notesSummary,
  metadata,
}: {
  calLink: string
  slotMins: number
  prefill: BookingContact
  notesSummary: string
  metadata: BookingMetadata
}) {
  const t = useTranslations("booking")
  const router = useRouter()

  const onSuccess = async (uid: string | undefined) => {
    // The email rides along to prefill the account block on /confirmation.
    const query = {
      ...(uid ? { uid } : {}),
      ...(prefill.email ? { email: prefill.email } : {}),
    }
    if (uid) await settleBookingRow(uid)
    router.replace({ pathname: routes.confirmation, query })
  }

  // The visitor's own notes ride along under the composed summary so the
  // artist sees both; metadata keys use Cal's `metadata[key]` param form.
  const notes = [notesSummary, prefill.notes].filter(Boolean).join("\n\n")

  return (
    <CalEmbedShell
      calLink={calLink}
      successAction="bookingSuccessfulV2"
      onSuccess={onSuccess}
      config={{
        name: prefill.name ?? "",
        email: prefill.email ?? "",
        ...(prefill.phone ? { attendeePhoneNumber: prefill.phone } : {}),
        notes,
        duration: String(slotMins),
        // NOTE: Cal cloud has no per-visitor language override — the booker
        // auto-detects the browser language (calcom/cal.com#8904).
        theme: "light",
        "metadata[serviceId]": metadata.serviceId,
        "metadata[addonIds]": metadata.addonIds.join(","),
        "metadata[totalPriceCents]": String(metadata.totalPriceCents),
        "metadata[totalDurationMins]": String(metadata.totalDurationMins),
        "metadata[locale]": metadata.locale,
        ...(metadata.clientNotes
          ? {
              // Surrogate-safe truncation — a plain slice can split an emoji
              // into a lone surrogate that breaks URL encoding.
              "metadata[clientNotes]": [...metadata.clientNotes]
                .slice(0, 500)
                .join(""),
            }
          : {}),
      }}
      loadingLabel={t("embedLoading")}
      securingLabel={t("securingBooking")}
    />
  )
}

export type { BookingMetadata }
