"use client"

import { useState, useTransition } from "react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { PriceHistoryPanel } from "@/components/admin/price-history-panel"
import { archiveService, updateService } from "@/modules/catalog/service-actions"

const fieldLabel = "text-[10px] tracking-widest-lux"
const DURATION_STEP = 15

export type EditableService = {
  id: string
  name_en: string
  name_dk: string
  description_en: string | null
  description_dk: string | null
  base_price_cents: number
  base_duration_mins: number
  archived_at: string | null
}

export function EditServiceSheet({ service }: { service: EditableService }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [nameEn, setNameEn] = useState(service.name_en)
  const [nameDa, setNameDa] = useState(service.name_dk)
  const [descriptionEn, setDescriptionEn] = useState(service.description_en ?? "")
  const [descriptionDa, setDescriptionDa] = useState(service.description_dk ?? "")
  const [priceKr, setPriceKr] = useState(String(service.base_price_cents / 100))
  const [durationMins, setDurationMins] = useState(service.base_duration_mins)

  const archived = Boolean(service.archived_at)

  const save = () =>
    startTransition(async () => {
      const result = await updateService(service.id, {
        nameEn,
        nameDa,
        descriptionEn,
        descriptionDa,
        priceKr: Number(priceKr),
        durationMins,
      })
      if (result.ok) {
        toast.success("Service saved")
        setOpen(false)
      } else {
        toast.error(
          result.error === "unauthorized"
            ? "Not allowed."
            : result.error || "Couldn’t save.",
        )
      }
    })

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await archiveService(service.id, !archived)
      if (result.ok) {
        toast.success(archived ? "Service restored" : "Service archived")
        setOpen(false)
      } else {
        toast.error(result.error || "Couldn’t update.")
      }
    })

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>Edit service</SheetTitle>
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
              <Label htmlFor="name-en" className={fieldLabel}>
                Name · EN
              </Label>
              <Input
                id="name-en"
                value={nameEn}
                onValueChange={setNameEn}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name-da" className={fieldLabel}>
                Name · DA
              </Label>
              <Input
                id="name-da"
                value={nameDa}
                onValueChange={setNameDa}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="price" className={fieldLabel}>
                Price · DKK
              </Label>
              <Input
                id="price"
                inputMode="decimal"
                value={priceKr}
                onValueChange={setPriceKr}
              />
            </div>
            <div className="space-y-1">
              <Label className={fieldLabel}>Duration</Label>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Less time"
                  onClick={() =>
                    setDurationMins((d) => Math.max(DURATION_STEP, d - DURATION_STEP))
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="desc-en" className={fieldLabel}>
                Description · EN
              </Label>
              <Textarea
                id="desc-en"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc-da" className={fieldLabel}>
                Description · DA
              </Label>
              <Textarea
                id="desc-da"
                value={descriptionDa}
                onChange={(e) => setDescriptionDa(e.target.value)}
              />
            </div>
          </div>

          <PriceHistoryPanel entityType="service" entityId={service.id} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={toggleArchive}
              className="text-destructive hover:text-destructive"
            >
              {archived ? "Restore" : "Archive"}
            </Button>
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
