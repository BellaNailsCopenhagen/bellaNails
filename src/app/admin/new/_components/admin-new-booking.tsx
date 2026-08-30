"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { H2, BodySm, Caption } from "@/components/ui/typography"
import type { SlotPickerOutcome } from "@/components/booking/slot-picker"
import type { Slot } from "@/shared/booking-slots"
import { routes } from "@/shared/routes"
import {
  createBookingAsOwner,
  getOwnerOverrideSlots,
  getOwnerSlots,
} from "@/modules/booking/create-booking-actions"
import { getServiceAddonsForOwner } from "@/modules/catalog/service-actions"

import { ClientStep } from "./client-step"
import { ServiceStep } from "./service-step"
import { AddonsStep } from "./addons-step"
import { TimeStep } from "./time-step"
import type {
  CategoryGroup,
  ClientOption,
  ClientRef,
  ServiceAddon,
  ServiceOption,
} from "./types"

type Step = "client" | "service" | "addons" | "time"
const ORDER: Step[] = ["client", "service", "addons", "time"]
const TITLE: Record<Step, string> = {
  client: "Client",
  service: "Service",
  addons: "Add-ons",
  time: "Time",
}

/**
 * Admin "New booking" stepper: client → service → add-ons → time. Holds the
 * whole selection; add-ons and slots are fetched on demand via owner-gated
 * actions, and the final confirm creates the booking on the client's behalf.
 */
export function AdminNewBooking({
  clients,
  categories,
  maxAdvanceDays,
  initialClient,
  initialService,
  initialAddonIds,
}: {
  clients: ClientOption[]
  categories: CategoryGroup[]
  maxAdvanceDays: number
  initialClient: ClientOption | null
  /** "Book again" deep link: client + service prefilled, its add-ons pre-checked. */
  initialService: ServiceOption | null
  initialAddonIds: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // A card's "Book again" lands here with both client + service prefilled (its
  // add-ons load on mount). Null on a plain New booking.
  const prefill =
    initialClient && initialService
      ? { service: initialService, addonIds: initialAddonIds }
      : null

  const [step, setStep] = useState<Step>(
    prefill ? "addons" : initialClient ? "service" : "client",
  )
  const [clientRef, setClientRef] = useState<ClientRef | null>(
    initialClient
      ? { kind: "existing", id: initialClient.id, name: initialClient.name }
      : null,
  )
  const [service, setService] = useState<ServiceOption | null>(
    prefill ? prefill.service : null,
  )
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [incompatiblePairs, setIncompatiblePairs] = useState<[string, string][]>([])
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState("")
  const [slots, setSlots] = useState<Slot[]>([])
  // "Ignore all limits" — swap in the override slots (any day, hours ignored,
  // but taken slots still removed). Loaded lazily when the toggle turns on.
  const [ignoreLimits, setIgnoreLimits] = useState(false)
  const [overrideSlots, setOverrideSlots] = useState<Slot[] | null>(null)
  // The rebook prefill resolves its add-ons async — hold the UI until it lands.
  const [bootstrapping, setBootstrapping] = useState(prefill !== null)
  const bootstrapped = useRef(false)

  // Load a service's add-ons and open the add-ons step (which doubles as the
  // notes + total review, even when there are none). A rebook may carry add-ons
  // since archived — keep only the ones still on offer.
  const enterService = (chosen: ServiceOption, preselectIds: string[]) => {
    setService(chosen)
    startTransition(async () => {
      try {
        const { addons, incompatiblePairs } = await getServiceAddonsForOwner(chosen.id)
        setAddons(addons)
        setIncompatiblePairs(incompatiblePairs)
        // Keep preselected add-ons still on offer, greedily dropping any that
        // clash — a rebook can carry a pair the catalog has since made incompatible.
        const live = new Set(addons.map((a) => a.id))
        const kept: string[] = []
        for (const id of preselectIds) {
          if (!live.has(id)) continue
          const clashes = incompatiblePairs.some(
            ([a, b]) => (a === id && kept.includes(b)) || (b === id && kept.includes(a)),
          )
          if (!clashes) kept.push(id)
        }
        setSelectedAddonIds(new Set(kept))
        setStep("addons")
      } catch {
        toast.error("Couldn’t load add-ons — try again.")
        setStep("service")
      }
    })
  }

  const selectService = (chosen: ServiceOption) => enterService(chosen, [])

  // Rebook deep link: preload the prefilled service's add-ons once on mount.
  useEffect(() => {
    if (bootstrapped.current || !prefill) return
    bootstrapped.current = true
    enterService(prefill.service, prefill.addonIds)
    setBootstrapping(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only prefill
  }, [])

  const toggleAddon = (id: string) =>
    setSelectedAddonIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const goToTime = () => {
    if (!service) return
    // Re-entering the time step (e.g. after changing add-ons) resets the override
    // toggle + its cached slots, so a stale duration can't linger.
    setIgnoreLimits(false)
    setOverrideSlots(null)
    startTransition(async () => {
      try {
        setSlots(await getOwnerSlots(service.id, [...selectedAddonIds]))
        setStep("time")
      } catch {
        toast.error("Couldn’t load available times — try again.")
      }
    })
  }

  // Toggle "ignore all limits" → lazy-load the override slots (any day, hours
  // ignored, existing bookings still excluded).
  const toggleIgnore = (next: boolean) => {
    setIgnoreLimits(next)
    if (!next || overrideSlots !== null || !service) return
    startTransition(async () => {
      try {
        setOverrideSlots(await getOwnerOverrideSlots(service.id, [...selectedAddonIds]))
      } catch {
        setOverrideSlots([])
        toast.error("Couldn’t load times — try again.")
      }
    })
  }

  const confirm = async (start: string): Promise<SlotPickerOutcome> => {
    if (!clientRef || !service) return { ok: false, error: "Missing selection." }
    const clientFields =
      clientRef.kind === "existing"
        ? { clientId: clientRef.id }
        : { email: clientRef.email, name: clientRef.name, phone: clientRef.phone }
    const result = await createBookingAsOwner({
      ...clientFields,
      serviceId: service.id,
      addonIds: [...selectedAddonIds],
      start,
      notes: notes.trim() || undefined,
      ignoreLimits,
    })
    if (!result.ok) return { ok: false, error: result.error }
    toast.success("Booking created")
    router.push(routes.admin.home)
    router.refresh()
    return { ok: true }
  }

  const stepIndex = ORDER.indexOf(step)
  const summary = useMemo(
    () =>
      [
        stepIndex > 0 && clientRef ? { label: "Client", value: clientRef.name } : null,
        stepIndex > 1 && service ? { label: "Service", value: service.name } : null,
      ].filter((row): row is { label: string; value: string } => row !== null),
    [stepIndex, clientRef, service],
  )

  const goBack = () => setStep(ORDER[stepIndex - 1])

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href={routes.admin.home}
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>New booking</H2>
        <Caption className="block text-[10px] tracking-widest-lux">
          Step {stepIndex + 1} of {ORDER.length} · {TITLE[step]}
        </Caption>
      </div>

      {summary.length ? (
        <div className="space-y-1">
          {summary.map((row) => (
            <p key={row.label} className="font-functional text-sm text-muted-foreground">
              <span className="text-foreground">{row.label}:</span> {row.value}
            </p>
          ))}
        </div>
      ) : null}

      {stepIndex > 0 ? (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Back
        </button>
      ) : null}

      {pending || bootstrapping ? (
        <BodySm>Loading…</BodySm>
      ) : step === "client" ? (
        <ClientStep
          clients={clients}
          onSelect={(ref) => {
            setClientRef(ref)
            setStep("service")
          }}
        />
      ) : step === "service" ? (
        <ServiceStep categories={categories} onSelect={selectService} />
      ) : step === "addons" && service ? (
        <AddonsStep
          service={service}
          addons={addons}
          incompatiblePairs={incompatiblePairs}
          selectedIds={selectedAddonIds}
          onToggle={toggleAddon}
          notes={notes}
          onNotesChange={setNotes}
          onContinue={goToTime}
        />
      ) : step === "time" ? (
        <div className="space-y-5">
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

          {ignoreLimits && overrideSlots === null ? (
            <BodySm>Loading times…</BodySm>
          ) : (
            <TimeStep
              // Remount on toggle so a stale day/time can't survive the switch.
              key={ignoreLimits ? "override" : "normal"}
              slots={ignoreLimits ? (overrideSlots ?? []) : slots}
              maxAdvanceDays={maxAdvanceDays}
              onConfirm={confirm}
              override={ignoreLimits}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
