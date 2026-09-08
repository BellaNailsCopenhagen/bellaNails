"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { SlotPicker } from "@/components/booking/slot-picker"
import { cardActionNeutral } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  acceptBookingRequest,
  getOwnerSlotsForRequest,
  rejectBookingRequest,
} from "@/modules/booking/request-actions"
import type { RequestView } from "@/modules/booking"
import { OVERRIDE_WINDOW_LABEL, type Slot } from "@/shared/booking-slots"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

const KIND_LABEL: Record<string, string> = {
  outside_hours: "Outside hours",
  over_limit: "Over the 2-booking limit",
}

// Same wording as the admin New-booking picker (this is the same availability).
const SLOT_LABELS = {
  chooseDate: "Choose a date",
  chooseTime: "Choose a time",
  empty: "No available times right now.",
  confirm: "Book this time",
  confirming: "Booking…",
  genericError: "Couldn’t book — try another time.",
  advanceNote: "The studio's normal available times.",
  availableLegend: "Available",
  prevMonth: "Previous month",
  nextMonth: "Next month",
}

// Override picker: hours + days off ignored — only taken slots are removed.
const OVERRIDE_LABELS = {
  ...SLOT_LABELS,
  advanceNote: `Working hours & days off ignored (${OVERRIDE_WINDOW_LABEL}) — only taken slots are hidden.`,
}

export function AdminRequestCard({
  request,
  contact,
}: {
  request: RequestView
  contact?: ClientContact
}) {
  const { pending, run } = useActionRunner()
  const router = useRouter()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [overrideSlots, setOverrideSlots] = useState<Slot[] | null>(null)
  const [ignoreLimits, setIgnoreLimits] = useState(false)

  const clientName = contactDisplayName(contact)

  // Both pickers accept the request at the chosen time; the overlap constraint
  // still blocks a clash. Returning { ok: true } keeps the picker quiet — we
  // close + refresh instead.
  const confirmSlot = async (start: string) => {
    const res = await acceptBookingRequest(request.id, { startIso: start })
    if (res.ok) {
      setAdjustOpen(false)
      router.refresh()
      return { ok: true as const }
    }
    return { ok: false as const, error: res.error }
  }

  // Lazy-load the studio's available slots the first time Adjust opens. Keyed
  // on the REQUEST, not on a service ref built here: the length comes from the
  // request's own snapshot server-side, which is what accepting books — so the
  // picker can't offer a slot of a length the accept then ignores.
  const openAdjust = () => {
    setAdjustOpen(true)
    if (slots === null) {
      getOwnerSlotsForRequest(request.id)
        .then(setSlots)
        .catch(() => {
          setSlots([])
          toast.error("Couldn’t load times — try again.")
        })
    }
  }

  // Toggle "ignore all limits" → lazy-load the override slots (any day, hours
  // ignored, existing bookings still excluded).
  const toggleIgnore = (next: boolean) => {
    setIgnoreLimits(next)
    if (next && overrideSlots === null) {
      getOwnerSlotsForRequest(request.id, true)
        .then(setOverrideSlots)
        .catch(() => {
          setOverrideSlots([])
          toast.error("Couldn’t load times — try again.")
        })
    }
  }

  return (
    <TintedCard
      id={`request-${request.id}`}
      className="scroll-mt-24 space-y-3 p-4"
    >
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {request.serviceId ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={openAdjust}>
              Adjust time
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => acceptBookingRequest(request.id))}
          >
            Accept &amp; book
          </Button>
        </div>
      </div>

      {/* Adjust time — the same date/time picker + availability as any admin
          booking, in a dialog. Picking a slot accepts the request at that time. */}
      <Sheet open={adjustOpen} onOpenChange={setAdjustOpen}>
        {/* Flex column: title + note stay pinned, the tall picker scrolls in the
            remaining space so its "Book this time" button is always reachable. */}
        <SheetContent className="flex max-h-[90vh] flex-col gap-4">
          <SheetTitle>Adjust time — {clientName}</SheetTitle>
          <BodySm className="text-xs text-muted-foreground">
            Pick an available studio time — or ignore hours to pick any free slot.
            Either way accepts the request and confirms the client.
          </BodySm>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ignoreLimits}
              onChange={(e) => toggleIgnore(e.target.checked)}
              className="size-4"
            />
            <span className="font-functional text-sm text-foreground">
              Ignore hours &amp; days off — pick any free slot
            </span>
          </label>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(ignoreLimits ? overrideSlots : slots) === null ? (
              <BodySm className="text-sm text-muted-foreground">
                Loading times…
              </BodySm>
            ) : (
              <SlotPicker
                // Remount on toggle so the picker's selection can't persist
                // across modes (a stale override day surviving the switch).
                key={ignoreLimits ? "override" : "normal"}
                slots={(ignoreLimits ? overrideSlots : slots) ?? []}
                locale={ADMIN_LOCALE}
                onConfirm={confirmSlot}
                labels={ignoreLimits ? OVERRIDE_LABELS : SLOT_LABELS}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

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
