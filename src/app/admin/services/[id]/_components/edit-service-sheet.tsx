"use client"

import { useState, useTransition } from "react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  CategorySelect,
  type CategoryOption,
} from "@/components/admin/category-select"
import { PriceHistoryPanel } from "@/components/admin/price-history-panel"
import { archiveService, updateService } from "@/modules/catalog/service-actions"
import { FieldLabel, fieldLabel, RequiredLegend } from "@/components/admin/field-label"
import { parseKroner } from "@/shared/money"

const DURATION_STEP = 15

export type EditableService = {
  id: string
  name_en: string
  name_dk: string
  description_en: string | null
  description_dk: string | null
  base_price_cents: number
  base_duration_mins: number
  category_id: string | null
  archived_at: string | null
}

export function EditServiceSheet({
  service,
  categories,
}: {
  service: EditableService
  /** Every category, archived included — see CategorySelect. */
  categories: CategoryOption[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [nameEn, setNameEn] = useState(service.name_en)
  const [nameDa, setNameDa] = useState(service.name_dk)
  const [descriptionEn, setDescriptionEn] = useState(service.description_en ?? "")
  const [descriptionDa, setDescriptionDa] = useState(service.description_dk ?? "")
  const [priceKr, setPriceKr] = useState(String(service.base_price_cents / 100))
  const [durationMins, setDurationMins] = useState(service.base_duration_mins)
  const [categoryId, setCategoryId] = useState(service.category_id ?? "")

  const archived = Boolean(service.archived_at)

  // `Number("")` is 0 and 0 was a valid price, so clearing the box saved a free
  // service onto the public menu. Parse the STRING: missing stays missing, and
  // Danish grouping ("1.200") reads as 1200 rather than 1.2.
  const price = parseKroner(priceKr)
  const priceOk = price !== null && price > 0

  const save = () => {
    if (price === null || price <= 0) return
    startTransition(async () => {
      const result = await updateService(service.id, {
        nameEn,
        nameDa,
        descriptionEn,
        descriptionDa,
        priceKr: price,
        durationMins,
        categoryId: categoryId || null,
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
  }

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
              <FieldLabel htmlFor="name-en" required>
                Name · EN
              </FieldLabel>
              <Input
                id="name-en"
                aria-required="true"
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
              <FieldLabel htmlFor="price" required>
                Price · DKK
              </FieldLabel>
              <Input
                id="price"
                aria-required="true"
                inputMode="decimal"
                value={priceKr}
                onValueChange={setPriceKr}
                aria-invalid={!priceOk}
              />
              {priceOk ? null : (
                <p className="font-functional text-xs text-destructive">
                  Enter an amount above 0.
                </p>
              )}
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

          <CategorySelect
            id="edit-category"
            value={categoryId}
            options={categories}
            onChange={setCategoryId}
          />

          <PriceHistoryPanel entityType="service" entityId={service.id} />

          <RequiredLegend />

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
            <Button size="sm" disabled={pending || !priceOk} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
