"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { kindForType } from "@/lib/media-policy"
import { uploadMedia } from "@/lib/client/upload-media"
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

export type BookingOption = { id: string; label: string }

/**
 * The owner's image/video gallery for a client — upload (optionally attached to
 * a booking) + the grid with per-image publish-consent requests. Lives in the
 * admin client page's Gallery tab.
 */
export function ClientMediaGallery({
  clerkUserId,
  media,
  bookings = [],
  defaultBookingId = null,
}: {
  clerkUserId: string
  media: ClientMediaItem[]
  /** This client's bookings, newest first — the optional "attach to" picker. */
  bookings?: BookingOption[]
  /** Pre-selected booking (ongoing, else most recent ended). Empty = none. */
  defaultBookingId?: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState("")
  const [bookingId, setBookingId] = useState(defaultBookingId ?? "")
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
      const up = await uploadMedia(file, file.type)
      if (!up.ok) {
        toast.error(
          up.reason === "not_configured"
            ? "Storage isn’t set up yet."
            : up.reason === "unsupported"
              ? "That file type isn’t allowed."
              : "Upload failed.",
        )
        return
      }

      const result = await addClientMedia({
        clerkUserId,
        source: "owner",
        storageKey: up.key,
        kind: kindForType(file.type),
        bookingId: bookingId || null,
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

  return (
    <section className="space-y-4">
      {/* Upload an image or a demo video (owner exception). */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="media-caption" className={subLabel}>
            Caption (optional)
          </label>
          <Input id="media-caption" value={caption} onValueChange={setCaption} />
        </div>
        {bookings.length ? (
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="media-booking" className={subLabel}>
              Attach to booking (optional)
            </label>
            <select
              id="media-booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full min-w-0 border-b border-border bg-transparent px-0 py-3 font-functional text-base text-foreground outline-none focus-visible:border-foreground"
            >
              <option value="">No booking</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
    </section>
  )
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

/**
 * Data-use consent (name / testimonial on site / social). Stays on the client
 * page's main body, outside the Appointment/Gallery tabs.
 */
export function ClientDataConsent({
  clerkUserId,
  dataConsents,
}: {
  clerkUserId: string
  dataConsents: DataConsentItem[]
}) {
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) toast.error(result.error || "Something went wrong.")
    })

  const dataStatus = (purpose: string): ConsentStatus =>
    (dataConsents.find((c) => c.purpose === purpose)?.status ??
      "none") as ConsentStatus

  return (
    <section className="space-y-2">
      <Eyebrow as="h3">Data-use consent</Eyebrow>
      <ul className="space-y-2">
        {DATA_PURPOSES.map(({ purpose, label }) => {
          const status = dataStatus(purpose)
          return (
            <li key={purpose} className="flex items-center justify-between gap-3">
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
    </section>
  )
}
