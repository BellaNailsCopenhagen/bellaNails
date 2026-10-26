"use client"

import { useState, useTransition, type ComponentProps } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { SlotPicker } from "@/components/booking/slot-picker"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { createBookingRequest } from "@/modules/booking/request-actions"
import { routes } from "@/config/routes"
import type { Slot } from "@/shared/booking-slots"
import type { BookingContact } from "@/shared/contact-validation"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

/**
 * The client's booking-REQUEST form. `over_limit`: the time they picked is fixed
 * (past the 2-active cap) — one Send button. `outside_hours`: a calendar of
 * OUTSIDE-hours slots (SlotPicker) + a message; confirming a slot sends the
 * request. Contact comes from the flow (prefill). On success it's clear this is
 * a request, not a confirmed booking.
 */
export function BookingRequestForm({
  serviceId,
  addonIds,
  prefill,
  kind,
  fixedStart,
  slots,
  slotLabels,
  signInReturnPath,
  humanProof,
  onProofSpent,
}: {
  serviceId: string
  addonIds: string[]
  prefill: BookingContact
  kind: "outside_hours" | "over_limit"
  fixedStart?: string
  slots?: Slot[]
  slotLabels?: ComponentProps<typeof SlotPicker>["labels"]
  /** Where to return after sign-in if the session lapsed mid-flow. */
  signInReturnPath: string
  /** The solved human check from the step above — one tick covers both. */
  humanProof: string | null
  onProofSpent: () => void
}) {
  const locale = useLocale()
  const copy = useTranslations("booking.request")
  const router = useRouter()
  // A successful send navigates to /request-sent, so we own the transition here
  // rather than useActionRunner (whose success path also refreshes the route).
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")

  const sendRequest = async (startIso: string) => {
    const res = await createBookingRequest({
      serviceId,
      addonIds,
      start: startIso,
      kind,
      name: prefill.name ?? "",
      email: prefill.email,
      phone: prefill.phone,
      message: message.trim() || undefined,
      locale,
      honeypot: prefill.honeypot,
      humanProof: humanProof ?? undefined,
    })
    // Leave the booking flow for a dedicated confirmation — not a lingering card.
    if (res.ok) {
      router.replace(routes.requestSent)
    }
    // A proof is single-use, so a second send needs a fresh tick.
    else if (res.code === "human") {
      onProofSpent()
    }
    // Only reachable on a lapsed session (the gate is two steps back) — send
    // them to sign in and straight back to where they were.
    else if (res.code === "auth") {
      router.push({
        pathname: routes.signIn,
        query: { next: signInReturnPath },
      })
    }

    return res
  }

  return (
    <TintedCard className="space-y-4 p-5">
      <div className="space-y-1">
        <Eyebrow as="h3">
          {kind === "over_limit" ? copy("overTitle") : copy("outsideTitle")}
        </Eyebrow>
        <BodySm className="text-muted-foreground">
          {kind === "over_limit" ? copy("overBody") : copy("outsideBody")}
        </BodySm>
        {kind === "over_limit" ? (
          <BodySm className="text-muted-foreground">
            <Link
              href={routes.appointments}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {copy("mySpaceLink")}
            </Link>
          </BodySm>
        ) : null}
      </div>

      <label className="block space-y-1">
        <span className="font-functional text-xs text-muted-foreground">
          {copy("messageLabel")}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          disabled={pending}
          className="w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
        />
      </label>

      {kind === "over_limit" && fixedStart ? (
        <>
          <BodySm className="text-sm text-foreground">
            {formatStudioDate(fixedStart, locale)} ·{" "}
            {formatStudioTime(fixedStart, locale)} · {copy("notGuaranteed")}
          </BodySm>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await sendRequest(fixedStart)
                if (!res.ok) {
                  toast.error(res.error || copy("genericError"))
                }
              })
            }
          >
            {pending ? copy("sending") : copy("send")}
          </Button>
        </>
      ) : kind === "outside_hours" && slots && slotLabels ? (
        // A slot here books nothing — it sends the request for that time.
        <SlotPicker
          slots={slots}
          locale={locale}
          onConfirm={async (start) => {
            const res = await sendRequest(start)

            return res.ok ? { ok: true } : { ok: false, error: res.error }
          }}
          labels={slotLabels}
        />
      ) : null}
    </TintedCard>
  )
}
