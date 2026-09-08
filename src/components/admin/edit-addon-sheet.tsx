"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { BodySm } from "@/components/ui/typography"
import { PriceHistoryPanel } from "@/components/admin/price-history-panel"
import { linkAddon, saveAddon, setAddonCompatibility } from "@/modules/catalog/addon-actions"
import { FieldLabel, fieldLabel, RequiredLegend } from "@/components/admin/field-label"
import { parseKroner } from "@/shared/money"

const sectionLabel =
  "font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"
const DURATION_STEP = 15

export type EditableAddon = {
  id: string
  name_en: string
  name_dk: string
  extra_price_cents: number
  extra_duration_mins: number
}

/** One other add-on, for the "incompatible with" picker. */
export type AddonOption = { id: string; name_en: string }

/**
 * Create or edit a standalone add-on. On create, if `linkToServiceId` is given
 * (opened from a service), the new add-on is linked to that service too. When
 * editing, the dialog also manages which OTHER add-ons this one can't be booked
 * with (global incompatibilities) and shows its price history.
 */
export function EditAddonSheet({
  addon,
  linkToServiceId,
  triggerLabel,
  triggerVariant = "outline",
  otherAddons = [],
  incompatibleIds = [],
}: {
  addon?: EditableAddon
  /** Link the newly-created add-on to this service. */
  linkToServiceId?: string
  triggerLabel: string
  triggerVariant?: "outline" | "ghost"
  /** Active add-ons other than this one — the incompatibility choices. */
  otherAddons?: AddonOption[]
  /** Ids this add-on is currently incompatible with. */
  incompatibleIds?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const [nameEn, setNameEn] = useState(addon?.name_en ?? "")
  const [nameDa, setNameDa] = useState(addon?.name_dk ?? "")
  const [priceKr, setPriceKr] = useState(
    String((addon?.extra_price_cents ?? 0) / 100),
  )
  const [durationMins, setDurationMins] = useState(
    addon?.extra_duration_mins ?? 0,
  )

  const incompatible = new Set(incompatibleIds)

  // Same empty-field trap as a service, one rule apart: zero IS a real add-on
  // price (a bundled extra at no charge), so only a missing or unparseable
  // amount is refused — never turned into 0 by `Number("")`.
  const price = parseKroner(priceKr)
  const priceOk = price !== null

  const save = () => {
    if (price === null) return
    startTransition(async () => {
      const result = await saveAddon(addon?.id ?? null, {
        nameEn,
        nameDa,
        priceKr: price,
        durationMins,
      })
      if (!result.ok) {
        toast.error(result.error || "Couldn’t save.")
        return
      }
      if (!addon && linkToServiceId) {
        const link = await linkAddon(linkToServiceId, result.id)
        if (!link.ok) toast.error("Saved, but couldn’t link to the service.")
      }
      toast.success("Add-on saved")
      setOpen(false)
      router.refresh()
    })
  }

  const toggleIncompatible = (otherId: string, makeIncompatible: boolean) =>
    startTransition(async () => {
      if (!addon) return
      const result = await setAddonCompatibility(
        addon.id,
        otherId,
        makeIncompatible,
      )
      if (!result.ok) toast.error(result.error || "Couldn’t save.")
      else router.refresh()
    })

  return (
    <>
      <Button variant={triggerVariant} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>{addon ? "Edit add-on" : "New add-on"}</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="addon-en" required>
                Name · EN
              </FieldLabel>
              <Input id="addon-en" value={nameEn} onValueChange={setNameEn} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addon-da" className={fieldLabel}>
                Name · DA
              </Label>
              <Input id="addon-da" value={nameDa} onValueChange={setNameDa} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="addon-price" required>
                Extra price · DKK
              </FieldLabel>
              <Input
                id="addon-price"
                aria-required="true"
                inputMode="decimal"
                value={priceKr}
                onValueChange={setPriceKr}
                aria-invalid={!priceOk}
              />
              {priceOk ? null : (
                <p className="font-functional text-xs text-destructive">
                  Enter an amount — 0 is allowed for a free add-on.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className={fieldLabel}>Extra time</Label>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Less time"
                  onClick={() =>
                    setDurationMins((d) => Math.max(0, d - DURATION_STEP))
                  }
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Minus className="size-4" />
                </button>
                <span className="font-functional text-sm tabular-nums text-foreground">
                  {durationMins} min
                </span>
                <button
                  type="button"
                  aria-label="More time"
                  onClick={() => setDurationMins((d) => d + DURATION_STEP)}
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Incompatibilities are keyed by add-on id, so only when editing. */}
          {addon && otherAddons.length ? (
            <div className="space-y-2">
              <p className={sectionLabel}>Can’t be combined with</p>
              <ul className="space-y-2">
                {otherAddons.map((other) => {
                  const inc = incompatible.has(other.id)
                  return (
                    <li key={other.id}>
                      <label className="flex items-center gap-2 font-functional text-sm text-foreground">
                        <Checkbox
                          checked={inc}
                          onCheckedChange={() =>
                            toggleIncompatible(other.id, !inc)
                          }
                          disabled={pending}
                        />
                        <span>{other.name_en}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {addon ? (
            <PriceHistoryPanel entityType="addon" entityId={addon.id} />
          ) : null}

          {!addon ? (
            <BodySm className="text-xs text-muted-foreground">
              Save first — you can set incompatibilities once the add-on exists.
            </BodySm>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <RequiredLegend className="mr-auto" />
            <Button size="sm" disabled={pending || !priceOk} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
