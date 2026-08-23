"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { H2, BodySm, Caption } from "@/components/ui/typography"
import type { SlotPickerOutcome } from "@/components/booking/slot-picker"
import type { Slot } from "@/shared/booking-slots"
import { createBookingAsOwner, getOwnerSlots } from "@/modules/booking/create-booking-actions"
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
}: {
  clients: ClientOption[]
  categories: CategoryGroup[]
  maxAdvanceDays: number
  initialClient: ClientOption | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>(initialClient ? "service" : "client")
  const [clientRef, setClientRef] = useState<ClientRef | null>(
    initialClient
      ? { kind: "existing", id: initialClient.id, name: initialClient.name }
      : null,
  )
  const [service, setService] = useState<ServiceOption | null>(null)
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [incompatiblePairs, setIncompatiblePairs] = useState<[string, string][]>([])
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState("")
  const [slots, setSlots] = useState<Slot[]>([])

  const selectService = (chosen: ServiceOption) => {
    setService(chosen)
    setSelectedAddonIds(new Set())
    startTransition(async () => {
      try {
        const { addons, incompatiblePairs } = await getServiceAddonsForOwner(chosen.id)
        setAddons(addons)
        setIncompatiblePairs(incompatiblePairs)
        setStep("addons")
      } catch {
        toast.error("Couldn’t load add-ons — try again.")
      }
    })
  }

  const toggleAddon = (id: string) =>
    setSelectedAddonIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const goToTime = () => {
    if (!service) return
    startTransition(async () => {
      try {
        setSlots(await getOwnerSlots(service.id, [...selectedAddonIds]))
        setStep("time")
      } catch {
        toast.error("Couldn’t load available times — try again.")
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
    })
    if (!result.ok) return { ok: false, error: result.error }
    toast.success("Booking created")
    router.push("/admin")
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
          href="/admin"
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

      {pending ? (
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
        <TimeStep slots={slots} maxAdvanceDays={maxAdvanceDays} onConfirm={confirm} />
      ) : null}
    </div>
  )
}
