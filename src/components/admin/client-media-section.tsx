"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, ImagePlus, Share2, Store, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { kindForType } from "@/lib/media-policy"
import { useActionRunner } from "@/lib/hooks/use-action-runner"
import { uploadMedia } from "@/lib/client/upload-media"
import type {
  ClientMediaItem,
  ConsentStatus,
  DataConsentItem,
} from "@/lib/media"
import { addClientMedia, requestDataConsent } from "@/lib/actions/manage-media"

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

// Icon tint for a consent state — used on the gallery overlays.
// green = granted · amber = requested · red = declined · faint = none/withdrawn
function consentIconClass(status: ConsentStatus) {
  if (status === "granted") return "text-success"
  if (status === "declined") return "text-destructive"
  if (status === "requested") return "text-warning"
  return "text-muted-foreground/40"
}

const overlayChip =
  "flex size-6 items-center justify-center rounded-full border border-border bg-background/85 backdrop-blur-sm"

export type BookingOption = { id: string; label: string }

/**
 * The owner's image/video gallery for a client. Upload happens in a dialog
 * (optionally attached to a past/current booking); each thumbnail carries its
 * source + publish-consent state as corner icons rather than a badge row, so
 * the grid reads as a gallery. Lives in the admin client page's Gallery tab.
 */
export function ClientMediaGallery({
  clerkUserId,
  media,
  bookings = [],
  defaultBookingId = null,
}: {
  clerkUserId: string
  media: ClientMediaItem[]
  /** This client's attachable bookings (past/current), newest first. */
  bookings?: BookingOption[]
  /** Pre-selected booking (ongoing, else most recent). Empty = none. */
  defaultBookingId?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState("")
  const [bookingId, setBookingId] = useState(defaultBookingId ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

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
        setOpen(false)
        router.refresh() // show the new image without a manual reload
      } else {
        toast.error(result.error || "Couldn’t add.")
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow as="h3">Photos</Eyebrow>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ImagePlus className="size-4" />
          Upload media
        </Button>
      </div>

      {media.length ? (
        <ul className="columns-2 gap-4 sm:columns-3">
          {media.map((item) => (
            <li key={item.id} className="mb-4 break-inside-avoid">
              <div className="relative overflow-hidden rounded-sm border border-border">
                {item.kind === "video" ? (
                  <video
                    src={item.url}
                    controls
                    preload="metadata"
                    className="w-full"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.url}
                    alt={item.caption ?? "Client image"}
                    className="w-full"
                  />
                )}
                <span
                  className={`absolute top-1.5 left-1.5 ${overlayChip}`}
                  title={item.source === "client" ? "Client upload" : "Studio"}
                >
                  {item.source === "client" ? (
                    <User className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Store className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <span className={overlayChip} title={`Website: ${item.site}`}>
                    <Globe className={`size-3.5 ${consentIconClass(item.site)}`} />
                  </span>
                  <span className={overlayChip} title={`Social: ${item.some}`}>
                    <Share2
                      className={`size-3.5 ${consentIconClass(item.some)}`}
                    />
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No images yet.</BodySm>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>Upload media</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="media-caption" className={subLabel}>
              Caption (optional)
            </label>
            <Input
              id="media-caption"
              value={caption}
              onValueChange={setCaption}
            />
          </div>

          {bookings.length ? (
            <div className="space-y-1">
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
              <BodySm className="text-[0.625rem] text-muted-foreground">
                Only past or current completed sessions can receive photos.
              </BodySm>
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            hidden
            onChange={(e) => onFile(e.target.files)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Choose file & upload"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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
  const { pending, run } = useActionRunner()

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
