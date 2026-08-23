"use client"

import { useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { uploadMedia } from "@/shared/upload-media"
import type { PublishedImage } from "@/modules/catalog/image-actions"
import type { PickableAsset } from "@/modules/catalog"

/** `assetId` is null on a URL-only surface, where nothing links back to the
    asset row. */
export type PickedImage = { assetId: string | null; url: string }

/**
 * Choose a catalog image: upload a fresh studio one (published to a public
 * asset), or pick a consented client photo when the caller offers a pool.
 * Controlled — the parent owns the selected value.
 */
export function ImagePicker({
  value,
  publish,
  consentedAssets,
  onChange,
}: {
  value: PickedImage | null
  /** How an upload becomes a public image — the caller picks the variant that
      matches how its table stores the result (`asset_id` vs. a bare URL). */
  publish: (storageKey: string) => Promise<PublishedImage>
  /** Omit to offer upload only. A surface that stores a bare URL rather than an
      `asset_id` can't follow a consent withdrawal, so it must not use client
      photos — withdrawal deletes the asset and would leave a dead image. */
  consentedAssets?: PickableAsset[]
  onChange: (value: PickedImage | null) => void
}) {
  const [showGallery, setShowGallery] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const up = await uploadMedia(file, file.type)
      if (!up.ok) {
        toast.error(
          up.reason === "unsupported"
            ? "That file type isn’t allowed."
            : up.reason === "not_configured"
              ? "Storage isn’t set up yet."
              : "Upload failed.",
        )
        return
      }
      const published = await publish(up.key)
      if (!published.ok) {
        toast.error(published.error)
        return
      }
      onChange({ assetId: published.assetId, url: published.url })
      setShowGallery(false)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt=""
            className="size-20 shrink-0 rounded-sm border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {consentedAssets ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowGallery((s) => !s)}
          >
            {showGallery ? "Hide gallery" : "Choose from gallery"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {uploading ? "Uploading…" : "Upload new"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => onFile(e.target.files)}
        />
      </div>

      {showGallery && consentedAssets ? (
        consentedAssets.length ? (
          <ul className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto">
            {consentedAssets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ assetId: asset.id, url: asset.url })
                    setShowGallery(false)
                  }}
                  className={`block w-full overflow-hidden rounded-sm border transition-colors ${
                    value?.assetId === asset.id
                      ? "border-foreground"
                      : "border-border hover:border-foreground/50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-functional text-xs text-muted-foreground">
            No consented photos yet — upload a new image instead.
          </p>
        )
      ) : null}
    </div>
  )
}
