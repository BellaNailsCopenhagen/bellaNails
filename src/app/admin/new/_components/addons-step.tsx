"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { BodySm, Caption } from "@/components/ui/typography"
import { fieldLabel } from "@/components/admin/field-label"
import { cn } from "@/shared/cn"

import type { ServiceAddon, ServiceOption } from "./types"

/**
 * Step 3 — optional add-ons + notes, with a running total. Add-ons that clash
 * with a current selection are disabled (incompatiblePairs), so an invalid combo
 * can't be built. If the service has no add-ons the step is just notes + total.
 */
export function AddonsStep({
  service,
  addons,
  incompatiblePairs,
  selectedIds,
  onToggle,
  notes,
  onNotesChange,
  onContinue,
}: {
  service: ServiceOption
  addons: ServiceAddon[]
  incompatiblePairs: [string, string][]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onContinue: () => void
}) {
  // Ids blocked because they clash with something already selected.
  const blocked = useMemo(() => {
    const set = new Set<string>()
    for (const [a, b] of incompatiblePairs) {
      if (selectedIds.has(a)) set.add(b)
      if (selectedIds.has(b)) set.add(a)
    }
    return set
  }, [incompatiblePairs, selectedIds])

  const { priceCents, durationMins } = useMemo(() => {
    let priceCents = service.priceCents
    let durationMins = service.durationMins
    for (const addon of addons) {
      if (selectedIds.has(addon.id)) {
        priceCents += addon.extra_price_cents
        durationMins += addon.extra_duration_mins
      }
    }
    return { priceCents, durationMins }
  }, [service, addons, selectedIds])

  return (
    <div className="space-y-8">
      {addons.length ? (
        <div className="space-y-2">
          <Caption className="block text-[10px] tracking-widest-lux">Add-ons</Caption>
          <ul className="border-t border-border">
            {addons.map((addon) => {
              const checked = selectedIds.has(addon.id)
              const disabled = !checked && blocked.has(addon.id)
              return (
                <li key={addon.id} className="border-b border-border">
                  <Label
                    className={cn(
                      "flex items-center justify-between gap-3 py-3 normal-case",
                      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => onToggle(addon.id)}
                      />
                      <span className="font-functional text-sm text-foreground">
                        {addon.name_en}
                        {addon.extra_duration_mins
                          ? ` · +${addon.extra_duration_mins} min`
                          : ""}
                      </span>
                    </span>
                    <PriceTag
                      cents={addon.extra_price_cents}
                      sign
                      className="shrink-0 text-sm text-muted-foreground"
                    />
                  </Label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <BodySm>No add-ons for this service.</BodySm>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="booking-notes" className={fieldLabel}>Notes (optional)</Label>
        <Textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Anything to note for this appointment"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
          Total · {durationMins} min
        </span>
        <PriceTag cents={priceCents} className="text-lg" />
      </div>

      <Button size="lg" onClick={onContinue}>
        Choose a time
      </Button>
    </div>
  )
}
