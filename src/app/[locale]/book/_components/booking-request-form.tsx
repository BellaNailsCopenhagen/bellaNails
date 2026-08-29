"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import { createBookingRequest } from "@/modules/booking/request-actions"
import type { BookingContact } from "@/shared/contact-validation"
import {
  formatStudioDate,
  formatStudioTime,
  studioInputToIso,
  studioInputValue,
} from "@/shared/studio-time"

const COPY = {
  da: {
    overTitle: "Send som anmodning",
    overBody:
      "Du har allerede 2 aktive bookinger. Send denne tid som en anmodning, så ser salonen på den.",
    outsideTitle: "Finder du ikke et tidspunkt?",
    outsideBody:
      "Foreslå en dato og tid, så vender vi tilbage. Tidspunktet er ikke garanteret.",
    dateLabel: "Ønsket dato og tid",
    messageLabel: "Besked (valgfrit)",
    send: "Send anmodning",
    sending: "Sender…",
    notGuaranteed: "ikke garanteret",
    successTitle: "Anmodning sendt",
    successBody:
      "Vi har sendt dig en bekræftelse på e-mail. Dette er ikke en booking endnu — vi vender tilbage for at bekræfte.",
    pickFirst: "Vælg en dato og tid.",
  },
  en: {
    overTitle: "Send as a request",
    overBody:
      "You already have 2 active bookings. Send this time as a request and the studio will take a look.",
    outsideTitle: "Can't find a time?",
    outsideBody:
      "Suggest a date and time and we'll get back to you. The time isn't guaranteed.",
    dateLabel: "Preferred date & time",
    messageLabel: "Message (optional)",
    send: "Send request",
    sending: "Sending…",
    notGuaranteed: "not guaranteed",
    successTitle: "Request sent",
    successBody:
      "We've emailed you a confirmation. This isn't a booking yet — we'll get back to you to confirm.",
    pickFirst: "Pick a date and time.",
  },
}

/**
 * The client's booking-REQUEST form, shown when the self-service flow won't grant
 * a slot: `over_limit` (past the 2-active cap — the time they picked is fixed) or
 * `outside_hours` (they choose an ideal date + time). Contact comes from the flow
 * (prefill). On success it's clear this is a request, not a confirmed booking.
 */
export function BookingRequestForm({
  serviceId,
  addonIds,
  prefill,
  kind,
  fixedStart,
}: {
  serviceId: string
  addonIds: string[]
  prefill: BookingContact
  kind: "outside_hours" | "over_limit"
  fixedStart?: string
}) {
  const locale = useLocale()
  const copy = locale === "en" ? COPY.en : COPY.da
  const { pending, run } = useActionRunner()
  const [when, setWhen] = useState(() =>
    fixedStart ? studioInputValue(fixedStart) : "",
  )
  const [minWhen] = useState(() => studioInputValue(new Date().toISOString()))
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <TintedCard className="space-y-2 p-5">
        <Eyebrow as="h3">{copy.successTitle}</Eyebrow>
        <BodySm className="text-muted-foreground">{copy.successBody}</BodySm>
      </TintedCard>
    )
  }

  const startIso = fixedStart ?? (when ? studioInputToIso(when) : null)

  const submit = () =>
    run(async () => {
      if (!startIso) return { ok: false, error: copy.pickFirst }
      const res = await createBookingRequest({
        serviceId,
        addonIds,
        start: startIso,
        kind,
        name: prefill.name ?? "",
        email: prefill.email ?? "",
        phone: prefill.phone,
        message: message.trim() || undefined,
        locale,
        honeypot: prefill.honeypot,
      })
      if (res.ok) setSent(true)
      return res
    })

  return (
    <TintedCard className="space-y-4 p-5">
      <div className="space-y-1">
        <Eyebrow as="h3">
          {kind === "over_limit" ? copy.overTitle : copy.outsideTitle}
        </Eyebrow>
        <BodySm className="text-muted-foreground">
          {kind === "over_limit" ? copy.overBody : copy.outsideBody}
        </BodySm>
      </div>

      {kind === "outside_hours" ? (
        <label className="block space-y-1">
          <span className="font-functional text-xs text-muted-foreground">
            {copy.dateLabel}
          </span>
          <input
            type="datetime-local"
            value={when}
            min={minWhen}
            onChange={(e) => setWhen(e.target.value)}
            disabled={pending}
            className="w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
          />
        </label>
      ) : fixedStart ? (
        <BodySm className="text-sm text-foreground">
          {formatStudioDate(fixedStart, locale)} ·{" "}
          {formatStudioTime(fixedStart, locale)} · {copy.notGuaranteed}
        </BodySm>
      ) : null}

      <label className="block space-y-1">
        <span className="font-functional text-xs text-muted-foreground">
          {copy.messageLabel}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          disabled={pending}
          className="w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
        />
      </label>

      <Button
        disabled={pending || (kind === "outside_hours" && !startIso)}
        onClick={submit}
      >
        {pending ? copy.sending : copy.send}
      </Button>
    </TintedCard>
  )
}
