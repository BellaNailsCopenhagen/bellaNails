"use client"

import { useState } from "react"
import { Pencil, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { GalleryItemSheet } from "@/app/admin/gallery/_components/gallery-item-sheet"
import { GalleryOwnershipNotice } from "@/app/admin/gallery/_components/gallery-ownership-notice"
import type { StudioGalleryImage } from "@/modules/media/gallery-preview"
import { GALLERY_SLOTS } from "@/shared/gallery-slots"

/**
 * The studio's own gallery: add, edit, feature and take down. Featured images
 * come first because their position is the thing most likely to be wrong — the
 * home page reads five fixed slots, and the grid should look like that page.
 */
export function StudioGalleryManager({ items }: { items: StudioGalleryImage[] }) {
  const [editing, setEditing] = useState<StudioGalleryImage | null>(null)
  const [adding, setAdding] = useState(false)

  const featured = items.filter((item) => item.slot != null)
  const rest = items.filter((item) => item.slot == null)

  return (
    <div className="space-y-6">
      <GalleryOwnershipNotice />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <BodySm className="text-xs text-muted-foreground">
          {featured.length} of {GALLERY_SLOTS.length} home-page positions used ·{" "}
          {items.length} on the gallery page
        </BodySm>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add an image
        </Button>
      </div>

      {items.length ? (
        <div className="space-y-8">
          {featured.length ? (
            <Group
              title="On the home page"
              items={featured}
              onEdit={setEditing}
            />
          ) : null}
          {rest.length ? (
            <Group
              title="Gallery page only"
              items={rest}
              onEdit={setEditing}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No studio images yet"
          body="Add a photo of your own work — it shows on the gallery page, and on the home page if you give it a position."
        />
      )}

      {adding ? (
        <GalleryItemSheet open onOpenChange={(next) => setAdding(next)} />
      ) : null}
      {editing ? (
        <GalleryItemSheet
          // Remounts per item, so the sheet's fields start from that image.
          key={editing.id}
          item={editing}
          open
          onOpenChange={(next) => !next && setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function Group({
  title,
  items,
  onEdit,
}: {
  title: string
  items: StudioGalleryImage[]
  onEdit: (item: StudioGalleryImage) => void
}) {
  return (
    <section className="space-y-3">
      <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
        {title}
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="group block w-full space-y-2 text-left"
            >
              <div className="relative overflow-hidden rounded-sm border border-border">
                {item.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.imageUrl}
                    alt={item.captionEn}
                    className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted">
                    <BodySm className="text-xs text-muted-foreground">
                      Image missing
                    </BodySm>
                  </div>
                )}
                {item.slot != null ? (
                  <span
                    title={`Home-page position ${item.slot}`}
                    className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 font-functional text-[0.5rem] uppercase tracking-widest-lux text-background"
                  >
                    <Star className="size-2.5 fill-current" />
                    {item.slot}
                  </span>
                ) : null}
                <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-background/85 text-muted-foreground backdrop-blur-sm">
                  <Pencil className="size-3" />
                </span>
              </div>
              <p className="truncate font-functional text-xs text-muted-foreground">
                {item.captionEn || item.captionDa || "No caption"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
