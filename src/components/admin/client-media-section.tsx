"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { kindForType } from "@/lib/media-policy"
import type {
  ClientMediaItem,
  ConsentStatus,
  DataConsentItem,
  MediaPurpose,
} from "@/lib/media"
import {
  addClientMedia,
  archiveClientMedia,
  requestDataConsent,
  requestMediaPublish,
} from "@/lib/actions/manage-media"

const subLabel =
  "font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground"

// Whether a fresh consent request makes sense (nothing pending/granted).
const canRequest = (status: ConsentStatus) =>
  status === "none" || status === "declined" || status === "withdrawn"

function consentVariant(status: ConsentStatus) {
  if (status === "granted") return "success" as const
  if (status === "declined") return "destructive" as const
  if (status === "requested") return "warning" as const
  return "outline" as const
}

const DATA_PURPOSES: {
  purpose: "testimonial_site" | "testimonial_some" | "name_site" | "name_some"
  label: string
}[] = [
  { purpose: "name_site", label: "Name · site" },
  { purpose: "name_some", label: "Name · social" },
  { purpose: "testimonial_site", label: "Testimonial · site" },
  { purpose: "testimonial_some", label: "Testimonial · social" },
]

export function ClientMediaSection({
  clerkUserId,
  media,
  dataConsents,
}: {
  clerkUserId: string
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
}) {
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) toast.error(result.error || "Something went wrong.")
    })

  // Owner upload: images or a demo video, no crop (decision 9).
  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const signRes = await fetch("/api/media/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (signRes.status === 503) {
        toast.info("Storage isn’t set up yet.")
        return
      }
      if (signRes.status === 400) {
        toast.error("That file type isn’t allowed.")
        return
      }
      if (!signRes.ok) {
        toast.error("Couldn’t start the upload.")
        return
      }
      const { url, key, fields } = (await signRes.json()) as {
        url: string
        key: string
        fields: Record<string, string>
      }

      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) form.set(k, v)
      form.set("file", file)
      const up = await fetch(url, { method: "POST", body: form })
      if (!up.ok) {
        toast.error("Upload failed.")
        return
      }

      const result = await addClientMedia({
        clerkUserId,
        source: "owner",
        storageKey: key,
        kind: kindForType(file.type),
        caption: caption.trim() || null,
      })
      if (result.ok) {
        toast.success("Added")
        setCaption("")
      } else {
        toast.error(result.error || "Couldn’t add.")
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const request = (mediaId: string, purpose: MediaPurpose) =>
    run(() => requestMediaPublish(mediaId, clerkUserId, purpose))

  const dataStatus = (purpose: string): ConsentStatus =>
    (dataConsents.find((c) => c.purpose === purpose)?.status ?? "none") as ConsentStatus

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eyebrow as="h3">Images</Eyebrow>
          <span className={subLabel}>{media.length}</span>
        </div>
      </div>

      {/* Upload an image or a demo video (owner exception). */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="media-caption" className={subLabel}>
            Caption (optional)
          </label>
          <Input id="media-caption" value={caption} onValueChange={setCaption} />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          hidden
          onChange={(e) => onFile(e.target.files)}
        />
        <Button
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {media.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {media.map((item) => (
            <li key={item.id} className="space-y-2">
              {item.kind === "video" ? (
                <video
                  src={item.url}
                  controls
                  preload="metadata"
                  className="aspect-square w-full rounded-sm border border-border object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.url}
                  alt={item.caption ?? "Client image"}
                  className="aspect-square w-full rounded-sm border border-border object-cover"
                />
              )}
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" size="xs">
                  {item.source === "client" ? "Client" : "Studio"}
                </Badge>
                <Badge variant={consentVariant(item.site)} size="xs">
                  site: {item.site}
                </Badge>
                <Badge variant={consentVariant(item.some)} size="xs">
                  social: {item.some}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {canRequest(item.site) ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => request(item.id, "site")}
                    className={`${subLabel} hover:text-foreground`}
                  >
                    Request site
                  </button>
                ) : null}
                {canRequest(item.some) ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => request(item.id, "some")}
                    className={`${subLabel} hover:text-foreground`}
                  >
                    Request social
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => archiveClientMedia(item.id, clerkUserId))
                  }
                  className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No images yet.</BodySm>
      )}

      {/* Data-use consent (name / testimonial). */}
      <div className="space-y-2 pt-4">
        <Eyebrow as="h4">Data-use consent</Eyebrow>
        <ul className="space-y-2">
          {DATA_PURPOSES.map(({ purpose, label }) => {
            const status = dataStatus(purpose)
            return (
              <li
                key={purpose}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 font-functional text-sm text-foreground">
                  {label}
                  <Badge variant={consentVariant(status)} size="xs">
                    {status}
                  </Badge>
                </span>
                {canRequest(status) ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => requestDataConsent(clerkUserId, purpose))
                    }
                    className={`${subLabel} hover:text-foreground`}
                  >
                    Request
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
