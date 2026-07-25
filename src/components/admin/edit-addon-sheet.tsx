"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { linkAddon, saveAddon } from "@/lib/actions/manage-services"

const fieldLabel = "text-[10px] tracking-widest-lux"
const DURATION_STEP = 15

export type EditableAddon = {
  id: string
  name_en: string
  name_dk: string
  extra_price_cents: number
  extra_duration_mins: number
}

/**
 * Create or edit a standalone add-on. On create, if `linkToServiceId` is given
 * (opened from a service), the new add-on is linked to that service too.
 */
export function EditAddonSheet({
  addon,
  linkToServiceId,
  triggerLabel,
  triggerVariant = "outline",
}: {
  addon?: EditableAddon
  /** Link the newly-created add-on to this service. */
  linkToServiceId?: string
  triggerLabel: string
  triggerVariant?: "outline" | "ghost"
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

  const save = () =>
    startTransition(async () => {
      const result = await saveAddon(addon?.id ?? null, {
        nameEn,
        nameDa,
        priceKr: Number(priceKr),
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
              <Label htmlFor="addon-en" className={fieldLabel}>
                Name · EN
              </Label>
              <Input
                id="addon-en"
                value={nameEn}
                onValueChange={setNameEn}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addon-da" className={fieldLabel}>
                Name · DA
              </Label>
              <Input
                id="addon-da"
                value={nameDa}
                onValueChange={setNameDa}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="addon-price" className={fieldLabel}>
                Extra price · DKK
              </Label>
              <Input
                id="addon-price"
                inputMode="decimal"
                value={priceKr}
                onValueChange={setPriceKr}
              />
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

          <div className="flex justify-end">
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
