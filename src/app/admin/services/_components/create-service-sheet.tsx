"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CategorySelect } from "@/components/admin/category-select"
import { createService } from "@/modules/catalog/service-actions"
import { fieldLabel } from "@/components/admin/field-label"
import { routes } from "@/shared/routes"

const DURATION_STEP = 15

/** Create a service from the admin. Availability is computed in-house from the
    studio schedule — nothing external to provision. */
export function CreateServiceSheet({
  categories,
}: {
  categories: { id: string; name_en: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const [nameEn, setNameEn] = useState("")
  const [nameDa, setNameDa] = useState("")
  const [priceKr, setPriceKr] = useState("")
  const [durationMins, setDurationMins] = useState(45)
  const [categoryId, setCategoryId] = useState("")

  const create = () =>
    startTransition(async () => {
      const result = await createService({
        nameEn,
        nameDa,
        priceKr: Number(priceKr),
        durationMins,
        categoryId: categoryId || null,
      })
      if (result.ok) {
        toast.success("Service created")
        setOpen(false)
        router.push(routes.admin.service(result.id))
      } else {
        toast.error(result.error || "Couldn’t create.")
      }
    })

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New service
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>New service</SheetTitle>
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
              <Label htmlFor="new-en" className={fieldLabel}>
                Name · EN
              </Label>
              <Input
                id="new-en"
                value={nameEn}
                onValueChange={setNameEn}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-da" className={fieldLabel}>
                Name · DA
              </Label>
              <Input
                id="new-da"
                value={nameDa}
                onValueChange={setNameDa}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="new-price" className={fieldLabel}>
                Price · DKK
              </Label>
              <Input
                id="new-price"
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

          <CategorySelect
            id="new-category"
            value={categoryId}
            options={categories}
            onChange={setCategoryId}
          />

          <div className="flex justify-end">
            <Button size="sm" disabled={pending} onClick={create}>
              {pending ? "Creating…" : "Create service"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
