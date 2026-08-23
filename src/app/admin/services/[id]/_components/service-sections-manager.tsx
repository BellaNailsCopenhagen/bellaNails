"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import { ImagePicker, type PickedImage } from "@/components/admin/image-picker"
import { publishStudioAsset } from "@/modules/catalog/image-actions"
import {
  addSection,
  updateSection,
  deleteSection,
  moveSection,
} from "@/modules/catalog/section-actions"
import type { ServiceSection, PickableAsset } from "@/modules/catalog"
import { fieldLabel } from "@/components/admin/field-label"

const iconBtn =
  "flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"

/** Owner manager for a service's detail-page sections (image + text blocks). */
export function ServiceSectionsManager({
  serviceId,
  sections,
  consentedAssets,
}: {
  serviceId: string
  sections: ServiceSection[]
  consentedAssets: PickableAsset[]
}) {
  const [editing, setEditing] = useState<ServiceSection | "new" | null>(null)
  const { pending, run } = useActionRunner()

  return (
    <section className="space-y-3 pl-2">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="h3">Sections</Eyebrow>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          Add section
        </Button>
      </div>

      {sections.length ? (
        <ul className="space-y-2">
          {sections.map((section, index) => (
            <li
              key={section.id}
              className="flex items-center gap-3 rounded-sm border border-border p-2"
            >
              {section.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={section.imageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-sm border border-border object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-sm border border-dashed border-border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-functional text-sm text-foreground">
                  {section.titleEn || "Untitled section"}
                </p>
                <p className="truncate font-functional text-xs text-muted-foreground">
                  {section.bodyEn}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveSection(section.id, "up"))}
                  className={iconBtn}
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={pending || index === sections.length - 1}
                  onClick={() => run(() => moveSection(section.id, "down"))}
                  className={iconBtn}
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(section)}
                  className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No sections yet.</BodySm>
      )}

      {editing ? (
        <SectionEditor
          key={editing === "new" ? "new" : editing.id}
          serviceId={serviceId}
          section={editing === "new" ? null : editing}
          consentedAssets={consentedAssets}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  )
}

function SectionEditor({
  serviceId,
  section,
  consentedAssets,
  onClose,
}: {
  serviceId: string
  section: ServiceSection | null
  consentedAssets: PickableAsset[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [titleEn, setTitleEn] = useState(section?.titleEn ?? "")
  const [titleDk, setTitleDk] = useState(section?.titleDk ?? "")
  const [bodyEn, setBodyEn] = useState(section?.bodyEn ?? "")
  const [bodyDk, setBodyDk] = useState(section?.bodyDk ?? "")
  const [image, setImage] = useState<PickedImage | null>(
    section?.assetId && section.imageUrl
      ? { assetId: section.assetId, url: section.imageUrl }
      : null,
  )

  const save = () =>
    startTransition(async () => {
      const input = {
        titleEn,
        titleDk,
        bodyEn,
        bodyDk,
        assetId: image?.assetId ?? null,
      }
      const result = section
        ? await updateSection(section.id, input)
        : await addSection(serviceId, input)
      if (!result.ok) {
        toast.error(result.error || "Couldn’t save.")
        return
      }
      toast.success("Section saved")
      onClose()
      router.refresh()
    })

  const remove = () =>
    startTransition(async () => {
      if (!section) return
      const result = await deleteSection(section.id)
      if (!result.ok) {
        toast.error(result.error || "Couldn’t remove.")
        return
      }
      toast.success("Section removed")
      onClose()
      router.refresh()
    })

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
    >
      <SheetContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <SheetTitle>{section ? "Edit section" : "New section"}</SheetTitle>
          <button
            type="button"
            onClick={onClose}
            className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="space-y-1">
          <Label className={fieldLabel}>Image</Label>
          <ImagePicker
            value={image}
            publish={publishStudioAsset}
            consentedAssets={consentedAssets}
            onChange={setImage}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="sec-title-en" className={fieldLabel}>
              Title · EN
            </Label>
            <Input id="sec-title-en" value={titleEn} onValueChange={setTitleEn} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-title-da" className={fieldLabel}>
              Title · DA
            </Label>
            <Input id="sec-title-da" value={titleDk} onValueChange={setTitleDk} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="sec-body-en" className={fieldLabel}>
            Body · EN
          </Label>
          <Textarea
            id="sec-body-en"
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            className="min-h-28"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sec-body-da" className={fieldLabel}>
            Body · DA
          </Label>
          <Textarea
            id="sec-body-da"
            value={bodyDk}
            onChange={(e) => setBodyDk(e.target.value)}
            className="min-h-28"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {section ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save section"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
