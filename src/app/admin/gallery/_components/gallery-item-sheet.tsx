"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { ImagePicker, type PickedImage } from "@/components/admin/image-picker"
import { fieldLabel } from "@/components/admin/field-label"
import { useActionRunner } from "@/hooks/use-action-runner"
import { publishStudioAsset } from "@/modules/catalog/image-actions"
import {
  addGalleryItem,
  discardStudioAsset,
  removeGalleryItem,
  renameGalleryItem,
  replaceGalleryImage,
  setGalleryItemSlot,
} from "@/modules/media/studio-gallery-actions"
import type { StudioGalleryImage } from "@/modules/media/gallery-preview"
import { GALLERY_SLOTS } from "@/shared/gallery-slots"
import { cn } from "@/shared/cn"

/**
 * Create or edit one studio image: the picture, both captions, and whether it is
 * featured on the home page. One sheet for both, so adding and editing can't
 * drift apart — an edit that offers less than the add did is how a Danish
 * caption ends up impossible to change after the fact.
 *
 * The picker is given NO pool to choose from: a client's photo must never reach
 * this table, which carries no consent to withdraw it by.
 */
export function GalleryItemSheet({
  item,
  open,
  onOpenChange,
}: {
  /** Absent when adding. */
  item?: StudioGalleryImage
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { pending, run } = useActionRunner()
  const [image, setImage] = useState<PickedImage | null>(
    item?.imageUrl ? { assetId: item.assetId, url: item.imageUrl } : null,
  )

  // Every copy this sheet published. The picker publishes on file choice, so
  // abandoning the sheet — or picking a second photo — would strand the first in
  // the public bucket with no row pointing at it.
  const publishedHere = useRef<string[]>([])
  const savedRef = useRef(false)
  /** The copy the save actually kept — everything else this sheet made goes. */
  const keptAssetRef = useRef<string | null>(null)

  const onPick = (next: PickedImage | null) => {
    if (next?.assetId && next.assetId !== item?.assetId) {
      publishedHere.current.push(next.assetId)
    }
    setImage(next)
  }

  // Discard whatever this session published but did not end up using. Runs on
  // unmount, which covers Cancel, Esc, the backdrop and a successful save alike.
  useEffect(
    () => () => {
      const keep = savedRef.current ? keptAssetRef.current : item?.assetId
      for (const assetId of publishedHere.current) {
        if (assetId !== keep) {
          void discardStudioAsset(assetId)
        }
      }
    },
    [item?.assetId],
  )
  const [titleEn, setTitleEn] = useState(item?.captionEn ?? "")
  const [titleDa, setTitleDa] = useState(item?.captionDa ?? "")
  const [slot, setSlot] = useState<number | null>(item?.slot ?? null)

  const close = () => onOpenChange(false)

  const create = () =>
    run(async () => {
      if (!image?.assetId) {
        return { ok: false, error: "Upload an image first." }
      }
      const result = await addGalleryItem({
        assetId: image.assetId,
        titleEn,
        titleDa,
        slot,
      })
      if (result.ok) {
        savedRef.current = true
        keptAssetRef.current = image.assetId
        close()
      }

      return result.ok ? { ...result, note: "Added to the gallery" } : result
    })

  // Each field owns its own write, so a failure on one can't silently discard
  // the others — and the slot swap has to run server-side anyway to take the
  // position off whoever held it.
  const save = () =>
    run(async () => {
      if (!item) {
        return { ok: false, error: "not_found" }
      }
      if (image?.assetId && image.assetId !== item.assetId) {
        const swapped = await replaceGalleryImage(item.id, image.assetId)
        if (!swapped.ok) {
          return swapped
        }
        keptAssetRef.current = image.assetId
      }
      if (titleEn !== item.captionEn || titleDa !== item.captionDa) {
        const renamed = await renameGalleryItem(item.id, titleEn, titleDa)
        if (!renamed.ok) {
          return renamed
        }
      }
      if (slot !== item.slot) {
        const moved = await setGalleryItemSlot(item.id, slot)
        if (!moved.ok) {
          return moved
        }
      }
      savedRef.current = true
      keptAssetRef.current ??= item.assetId
      close()

      return { ok: true as const, note: "Saved" }
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-6">
        <SheetTitle>{item ? "Edit image" : "Add a studio image"}</SheetTitle>
        <BodySm className="text-xs text-muted-foreground">
          Your own work. For a client&rsquo;s photo use Client photos instead —
          that one needs their permission, and this page can&rsquo;t ask for it.
        </BodySm>

        <ImagePicker
          value={image}
          publish={publishStudioAsset}
          onChange={onPick}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="gallery-en" className={fieldLabel}>
              Caption · EN
            </Label>
            <Input
              id="gallery-en"
              value={titleEn}
              onValueChange={setTitleEn}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gallery-da" className={fieldLabel}>
              Caption · DA
            </Label>
            <Input
              id="gallery-da"
              value={titleDa}
              onValueChange={setTitleDa}
              placeholder="Valgfri"
            />
          </div>
        </div>
        <BodySm className="text-xs text-muted-foreground">
          The caption is the image&rsquo;s alt text — what a screen reader reads
          aloud and what a search engine indexes.
        </BodySm>

        <div className="space-y-2">
          <Label className={fieldLabel}>Featured on the home page</Label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setSlot(null)}
              className={cn(
                "rounded-full border px-3 py-1 font-functional text-xs transition-colors",
                slot === null
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Not featured
            </button>
            {GALLERY_SLOTS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={pending}
                onClick={() => setSlot(option)}
                className={cn(
                  "size-8 rounded-full border font-functional text-xs transition-colors",
                  slot === option
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <BodySm className="text-xs text-muted-foreground">
            Position 1 is the large image; 2&ndash;5 are the small ones beside
            it. Each position holds one image, so choosing a taken one moves the
            other out. Not featured still shows on the gallery page.
          </BodySm>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {item ? (
            <ConfirmActionButton
              action={async () => {
                const result = await removeGalleryItem(item.id)
                if (result.ok) {
                  close()
                }

                return result
              }}
              labels={{
                title: "Take this image down?",
                body: "It comes off the gallery page and the home page straight away, and the file is deleted. This can’t be undone.",
                confirm: "Take it down",
                confirming: "Removing…",
                cancel: "Keep it",
                failed: "Couldn’t remove it.",
              }}
              trigger={
                <button type="button" className={withdrawPill}>
                  Take it down
                </button>
              }
            />
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || !image}
              onClick={item ? save : create}
            >
              {pending ? "Saving…" : item ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
