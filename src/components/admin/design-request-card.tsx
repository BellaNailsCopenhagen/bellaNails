"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { SlotPicker } from "@/components/booking/slot-picker"
import { cardActionNeutral } from "@/components/admin/card-action"
import { CloseRequestButton } from "@/components/admin/close-request-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import { replyToDesignRequest } from "@/modules/design/request-actions"
import {
  bookOfferAsOwner,
  createOffer,
  withdrawOffer,
} from "@/modules/design/offer-actions"
import { getOwnerOfferSlots } from "@/modules/design/slot-actions"
import type { DesignRequestView } from "@/modules/design/reads"
import type { Slot } from "@/shared/booking-slots"
import { OVERRIDE_WINDOW_LABEL } from "@/shared/booking-slots"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import { OFFER_DURATION_PRESETS } from "@/shared/design"
import { OFFER_DEFAULT_DAYS } from "@/shared/offer"
import { formatPrice, parseKroner } from "@/shared/money"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

const TOPIC_LABEL: Record<string, string> = {
  new_design: "A design they've seen",
  repair: "Repair",
  other: "Something else",
}

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

const OVERRIDE_LABELS = {
  ...SLOT_LABELS,
  advanceNote: `Working hours & days off ignored (${OVERRIDE_WINDOW_LABEL}) — only taken slots are hidden.`,
}

/**
 * One design request, and the whole life of its offer — draft, sent, booked.
 * The offer deliberately has no page of its own: everything the artist does
 * with it happens on this card, so nothing accumulates elsewhere in the admin.
 */
export function DesignRequestCard({
  request,
  contact,
}: {
  request: DesignRequestView
  contact?: ClientContact
}) {
  const { pending, run } = useActionRunner()
  const router = useRouter()
  const [offerOpen, setOfferOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [reply, setReply] = useState("")

  const clientName = contactDisplayName(contact)
  // Only a LIVE offer is actionable. The expiry sweep is throttled, so a lapsed
  // offer can still be attached here — treat it as none, and allow a re-offer.
  const offer = request.offer?.state === "live" ? request.offer : null
  const lapsed = request.offer && request.offer.state !== "live"

  return (
    <TintedCard id={`design-${request.id}`} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BodySm className="text-base text-foreground">{clientName}</BodySm>
            <Badge variant={request.topic === "repair" ? "warning" : "outline"} size="xs">
              {TOPIC_LABEL[request.topic] ?? request.topic}
            </Badge>
            {/* The client had the last word — this one is on her. */}
            {request.awaitingArtist ? (
              <Badge variant="warning" size="xs">
                Needs a reply
              </Badge>
            ) : null}
          </div>
          {request.preferredWindow ? (
            <BodySm className="text-xs text-muted-foreground">
              Wants it: {request.preferredWindow}
            </BodySm>
          ) : null}
          {/* The queue is sorted by this, so show what it sorted on. */}
          <BodySm className="text-xs text-muted-foreground">
            Last activity{" "}
            {formatStudioDayMonthYear(
              Date.parse(request.lastActivityAt),
              ADMIN_LOCALE,
            )}
          </BodySm>
        </div>
        <div className="flex items-center gap-3">
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} aria-label="Email" title={contact.email}>
              <Mail className="size-4 text-muted-foreground hover:text-foreground" />
            </a>
          ) : null}
          {contact?.phone ? (
            <a href={telHref(contact.phone)} aria-label="Call" title={contact.phone}>
              <Phone className="size-4 text-muted-foreground hover:text-foreground" />
            </a>
          ) : null}
        </div>
      </div>

      {request.refs.length ? (
        <ul className="flex flex-wrap gap-2">
          {request.refs.map((ref) => (
            <li key={ref.id}>
              <a href={ref.url} target="_blank" rel="noreferrer">
                {/* Private object behind a short-lived signed URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref.url}
                  alt="Reference"
                  className="size-20 rounded-sm border border-border object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {request.messages.map((message) => (
          <li key={message.id} className="text-sm">
            <span className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
              {message.author === "artist" ? "You" : clientName}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap text-foreground">{message.body}</p>
          </li>
        ))}
      </ul>

      {offer ? (
        <div className="space-y-3 border-t border-border pt-3">
          <Eyebrow>Offer sent</Eyebrow>
          <BodySm className="text-foreground">
            {offer.nameEn} · {offer.durationMins} min ·{" "}
            {formatPrice(offer.priceCents, ADMIN_LOCALE)}
          </BodySm>
          <BodySm className="text-xs text-muted-foreground">
            Holds until {formatStudioDayMonthYear(Date.parse(offer.expiresAt), ADMIN_LOCALE)}
          </BodySm>
          {/* Taking-away actions left, going-forward actions right, primary
              last — the three used to sit shoulder to shoulder, one tap apart. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <CloseRequestButton
                requestId={request.id}
                clientName={clientName}
                hasLiveOffer
              />
              <button
                type="button"
                className={cardActionNeutral()}
                disabled={pending}
                onClick={() => run(() => withdrawOffer(offer.id))}
              >
                Withdraw offer
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                className={cardActionNeutral()}
                onClick={() => setReplyOpen(true)}
              >
                Reply
              </button>
              <Button size="sm" onClick={() => setBookOpen(true)}>
                Book it in
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          {lapsed ? (
            <BodySm className="text-xs text-muted-foreground">
              The previous offer {request.offer?.state === "used" ? "was booked" : "lapsed"}.
            </BodySm>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <CloseRequestButton
              requestId={request.id}
              clientName={clientName}
              hasLiveOffer={false}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                className={cardActionNeutral()}
                onClick={() => setReplyOpen(true)}
              >
                Reply
              </button>
              <Button size="sm" onClick={() => setOfferOpen(true)}>
                Make an offer
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={offerOpen} onOpenChange={setOfferOpen}>
        <SheetContent>
          <SheetTitle>Make an offer</SheetTitle>
          <OfferForm
            requestId={request.id}
            clientName={clientName}
            onDone={() => {
              setOfferOpen(false)
              router.refresh()
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={replyOpen} onOpenChange={setReplyOpen}>
        <SheetContent>
          <SheetTitle>Reply to {clientName}</SheetTitle>
          <div className="space-y-3 pt-4">
            <Textarea
              rows={5}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ask anything you need to know…"
            />
            <Button
              size="sm"
              disabled={pending || !reply.trim()}
              onClick={() =>
                run(async () => {
                  const result = await replyToDesignRequest(request.id, reply)
                  if (result.ok) {
                    setReply("")
                    setReplyOpen(false)
                  }
                  return result
                })
              }
            >
              Send reply
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {offer ? (
        <Sheet open={bookOpen} onOpenChange={setBookOpen}>
          <SheetContent>
            <SheetTitle>Book {clientName} in</SheetTitle>
            <BookOfferPicker
              offerId={offer.id}
              onBooked={() => {
                setBookOpen(false)
                router.refresh()
              }}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </TintedCard>
  )
}

/** Four fields. None of the service editor applies to a one-time offer. */
function OfferForm({
  requestId,
  clientName,
  onDone,
}: {
  requestId: string
  clientName: string
  onDone: () => void
}) {
  const { pending, run } = useActionRunner()
  const [name, setName] = useState("")
  const [mins, setMins] = useState<number>(60)
  const [kr, setKr] = useState("")
  const [note, setNote] = useState("")
  const [days, setDays] = useState(OFFER_DEFAULT_DAYS)

  // `parseKroner`, not `Number()`: this offer is a price quoted to a client, and
  // `Number("1.200")` is 1.2 — a 1.200 kr offer went out as 1,20 kr. It also
  // returns null for an empty or unparseable field, so "missing" stays missing
  // rather than becoming a free offer.
  const kroner = parseKroner(kr)
  const priceCents = kroner === null ? null : Math.round(kroner * 100)
  const validPrice = priceCents !== null && priceCents >= 0
  const valid = Boolean(name.trim()) && mins > 0 && validPrice

  return (
    <div className="space-y-5 pt-4">
      <BodySm className="text-xs text-muted-foreground">For {clientName}</BodySm>

      <div className="space-y-2">
        <label className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          What is it?
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Almond set, chrome finish, hand-painted detail"
        />
      </div>

      <div className="space-y-2">
        <label className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          How long?
        </label>
        <div className="flex flex-wrap gap-2">
          {OFFER_DURATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMins(preset)}
              className={
                mins === preset
                  ? "border border-foreground px-3 py-1 font-functional text-sm text-foreground"
                  : "border border-border px-3 py-1 font-functional text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {preset} min
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          Price (kr)
        </label>
        <Input
          inputMode="decimal"
          value={kr}
          onChange={(e) => setKr(e.target.value)}
          placeholder="350"
        />
      </div>

      <div className="space-y-2">
        <label className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          Offer details (optional)
        </label>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Two sessions' worth of detail in one sitting — I'll prep the art beforehand so we use the whole time on you."
        />
        {/* It reads like a note, and notes are private everywhere else in the
            admin — so say plainly that this one is not. */}
        <BodySm className="text-xs text-muted-foreground">
          The client reads this in the offer and the email. Private notes belong
          on the booking or the client.
        </BodySm>
      </div>

      <div className="space-y-2">
        <label className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          Holds for
        </label>
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={
                days === option
                  ? "border border-foreground px-3 py-1 font-functional text-sm text-foreground"
                  : "border border-border px-3 py-1 font-functional text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <Button
        disabled={pending || !valid}
        onClick={() =>
          run(async () => {
            const result = await createOffer({
              requestId,
              nameEn: name,
              durationMins: mins,
              priceCents: priceCents ?? 0,
              artistNote: note || undefined,
              holdDays: days,
            })
            if (result.ok) onDone()
            return result
          })
        }
      >
        Send offer
      </Button>
    </div>
  )
}

/** The urgent path: the artist places the offer herself, limits optional. */
function BookOfferPicker({
  offerId,
  onBooked,
}: {
  offerId: string
  onBooked: () => void
}) {
  const [ignoreLimits, setIgnoreLimits] = useState(false)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [overrideSlots, setOverrideSlots] = useState<Slot[] | null>(null)

  // The sheet mounts already open, so the normal picker loads immediately; the
  // override list waits until the artist actually asks for it.
  useEffect(() => {
    getOwnerOfferSlots(offerId, false)
      .then(setSlots)
      .catch(() => {
        setSlots([])
        toast.error("Couldn’t load times — try again.")
      })
  }, [offerId])

  const loadOverride = () => {
    getOwnerOfferSlots(offerId, true)
      .then(setOverrideSlots)
      .catch(() => {
        setOverrideSlots([])
        toast.error("Couldn’t load times — try again.")
      })
  }

  const confirm = async (start: string) => {
    const result = await bookOfferAsOwner({ offerId, start, ignoreLimits })
    if (!result.ok) return { ok: false as const, error: result.error }
    onBooked()
    return { ok: true as const }
  }

  return (
    <div className="space-y-4 pt-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={ignoreLimits}
          onChange={(e) => {
            setIgnoreLimits(e.target.checked)
            if (e.target.checked && overrideSlots === null) loadOverride()
          }}
          className="size-4"
        />
        <span className="font-functional text-sm text-foreground">
          Ignore hours &amp; days off — pick any free slot
        </span>
      </label>

      <SlotPicker
        key={ignoreLimits ? "override" : "normal"}
        slots={(ignoreLimits ? overrideSlots : slots) ?? []}
        locale={ADMIN_LOCALE}
        onConfirm={confirm}
        labels={ignoreLimits ? OVERRIDE_LABELS : SLOT_LABELS}
      />
    </div>
  )
}
