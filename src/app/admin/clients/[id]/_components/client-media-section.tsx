"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { HubAppointmentCard } from "@/components/admin/hub-appointment-card"
import { kindForType } from "@/shared/media-policy"
import { useActionRunner } from "@/hooks/use-action-runner"
import { uploadMedia } from "@/platform/storage/browser"
import type { HubAppointment } from "@/modules/media/asset-hub"
import type { ConsentStatus, DataConsentItem } from "@/modules/media/client-gallery"
import { addClientMedia, requestDataConsent } from "@/modules/media/owner-media-actions"

const subLabel =
  "font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground"

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
 * The owner's gallery for a client — upload (in a dialog, optionally attached to
 * a booking) plus the same per-asset cards as the hub, so consent + placement +
 * favourites are managed right here.
 */
export function ClientMediaGallery({
  clientId,
  hubAppointments,
  now,
  clientName,
  bookings = [],
  defaultBookingId = null,
}: {
  clientId: string
  hubAppointments: HubAppointment[]
  /** Request-time clock, from the page — a component may not read it. */
  now: number
  clientName: string
  bookings?: BookingOption[]
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
              : up.reason === "process_failed"
                ? "That image couldn’t be read."
                : "Upload failed.",
        )
        return
      }

      const result = await addClientMedia({
        clientId,
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

      {hubAppointments.length ? (
        <ul className="space-y-4">
          {hubAppointments.map((appointment) => (
            <HubAppointmentCard
              key={appointment.key}
              appointment={appointment}
              clientName={clientName}
              now={now}
              showClient={false}
            />
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
  clientId,
  dataConsents,
}: {
  clientId: string
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
                    run(() => requestDataConsent(clientId, purpose))
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
