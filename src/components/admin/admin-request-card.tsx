"use client"

import { useState } from "react"
import { Mail, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm } from "@/components/ui/typography"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cardActionNeutral } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  acceptBookingRequest,
  rejectBookingRequest,
} from "@/modules/booking/request-actions"
import type { RequestView } from "@/modules/booking"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import {
  formatStudioDate,
  formatStudioTime,
  studioInputToIso,
  studioInputValue,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

const KIND_LABEL: Record<string, string> = {
  outside_hours: "Outside hours",
  over_limit: "Over the 2-booking limit",
}

export function AdminRequestCard({
  request,
  contact,
}: {
  request: RequestView
  contact?: ClientContact
}) {
  const { pending, run } = useActionRunner()
  const [when, setWhen] = useState(studioInputValue(request.startIso))
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")

  const clientName = contactDisplayName(contact)
  // Interpret the input as studio wall-clock; null if cleared/invalid (guards Accept).
  const startIso = studioInputToIso(when)

  return (
    <TintedCard className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-functional text-sm font-medium text-foreground">
            {clientName}
          </p>
          <p className="font-functional text-sm text-muted-foreground">
            {request.serviceName}
          </p>
        </div>
        <Badge variant="warning" size="xs">
          {KIND_LABEL[request.kind] ?? request.kind}
        </Badge>
      </div>

      {/* Contact on any known channel. */}
      {contact?.phone || contact?.email ? (
        <div className="flex flex-wrap items-center gap-4">
          {contact?.phone ? (
            <a href={telHref(contact.phone)} className={cardActionNeutral("gap-1 text-[0.625rem]")}>
              <Phone className="size-3" />
              Call
            </a>
          ) : null}
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className={cardActionNeutral("gap-1 text-[0.625rem]")}>
              <Mail className="size-3" />
              Email
            </a>
          ) : null}
        </div>
      ) : null}

      {request.addonNames.length ? (
        <BodySm className="text-xs text-muted-foreground">
          + {request.addonNames.join(", ")}
        </BodySm>
      ) : null}

      <BodySm className="text-xs text-muted-foreground">
        Requested: {formatStudioDate(request.startIso, ADMIN_LOCALE)} ·{" "}
        {formatStudioTime(request.startIso, ADMIN_LOCALE)} · not guaranteed
      </BodySm>

      {request.message ? (
        <div className="rounded-sm border border-border bg-background/50 p-3">
          <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            Client note
          </p>
          <p className="font-functional text-sm text-foreground">{request.message}</p>
        </div>
      ) : null}

      {/* Adjust the time before accepting (defaults to the requested time). */}
      <label className="block space-y-1">
        <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
          Time (adjust if needed)
        </span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          disabled={pending}
          className="w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          disabled={pending || !startIso}
          onClick={() =>
            startIso &&
            run(() => acceptBookingRequest(request.id, { startIso }))
          }
        >
          Accept &amp; book
        </Button>
      </div>

      <AlertDialog
        open={rejectOpen}
        onOpenChange={(next) => {
          if (!pending) setRejectOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Reject this request?</AlertDialogTitle>
          <AlertDialogDescription>
            The client will be emailed that their request was declined. This
            can’t be undone — they’d need to send a new one.
          </AlertDialogDescription>
          <label className="mt-4 block space-y-1">
            <span className="font-functional text-xs text-muted-foreground">
              Reason (optional — included in the email)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={pending}
              className="w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
            />
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialogClose
              render={<Button variant="ghost" size="sm" disabled={pending} />}
            >
              Keep
            </AlertDialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await rejectBookingRequest(request.id, reason)
                  if (res.ok) setRejectOpen(false)
                  return res
                })
              }
            >
              Reject request
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </TintedCard>
  )
}
