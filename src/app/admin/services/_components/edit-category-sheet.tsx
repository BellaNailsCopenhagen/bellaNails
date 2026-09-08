"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { BodySm } from "@/components/ui/typography"
import { ImagePicker, type PickedImage } from "@/components/admin/image-picker"
import { publishStudioImageUrl } from "@/modules/catalog/image-actions"
import { saveCategory } from "@/modules/catalog/category-actions"
import { FieldLabel, fieldLabel, RequiredLegend } from "@/components/admin/field-label"

export type EditableCategory = {
  id: string
  name_en: string
  name_dk: string
  description_en: string | null
  description_dk: string | null
  image_url: string | null
}

/** Create or edit a category — the public menu's top level. Name, description
    and image are what the menu section renders, in both languages. */
export function EditCategorySheet({
  category,
  triggerLabel,
  triggerVariant = "outline",
}: {
  category?: EditableCategory
  triggerLabel: string
  triggerVariant?: "outline" | "ghost"
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const [nameEn, setNameEn] = useState(category?.name_en ?? "")
  const [nameDa, setNameDa] = useState(category?.name_dk ?? "")
  const [descriptionEn, setDescriptionEn] = useState(
    category?.description_en ?? "",
  )
  const [descriptionDa, setDescriptionDa] = useState(
    category?.description_dk ?? "",
  )
  // `categories.image_url` holds a bare URL, so only the url half is persisted.
  const [image, setImage] = useState<PickedImage | null>(
    category?.image_url ? { assetId: null, url: category.image_url } : null,
  )

  const save = () =>
    startTransition(async () => {
      const result = await saveCategory(category?.id ?? null, {
        nameEn,
        nameDa,
        descriptionEn,
        descriptionDa,
        imageUrl: image?.url ?? null,
      })
      if (!result.ok) {
        toast.error(
          result.error === "unauthorized"
            ? "Not allowed."
            : result.error || "Couldn’t save.",
        )
        return
      }
      toast.success("Category saved")
      if (!category) {
        setNameEn("")
        setNameDa("")
        setDescriptionEn("")
        setDescriptionDa("")
        setImage(null)
      }
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
            <SheetTitle>{category ? "Edit category" : "New category"}</SheetTitle>
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
              <FieldLabel htmlFor="category-en" required>
                Name · EN
              </FieldLabel>
              <Input id="category-en" value={nameEn} onValueChange={setNameEn} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-da" className={fieldLabel}>
                Name · DA
              </Label>
              <Input id="category-da" value={nameDa} onValueChange={setNameDa} />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-1">
              <Label htmlFor="category-desc-en" className={fieldLabel}>
                Description · EN
              </Label>
              <Textarea
                id="category-desc-en"
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-desc-da" className={fieldLabel}>
                Description · DA
              </Label>
              <Textarea
                id="category-desc-da"
                value={descriptionDa}
                onChange={(event) => setDescriptionDa(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className={fieldLabel}>Menu image</Label>
            <ImagePicker
              value={image}
              publish={publishStudioImageUrl}
              onChange={setImage}
            />
            <BodySm className="text-xs text-muted-foreground">
              Upload only — a client photo would break here if its consent were
              withdrawn.
            </BodySm>
          </div>

          {!category ? (
            <BodySm className="text-xs text-muted-foreground">
              New categories land at the end of the menu — reorder them from the
              list. File services under it from each service’s Edit sheet.
            </BodySm>
          ) : null}

          <RequiredLegend />


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
