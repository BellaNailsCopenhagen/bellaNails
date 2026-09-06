"use client"

import { useActionRunner } from "@/hooks/use-action-runner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { HubPhotoTile } from "@/components/admin/hub-photo-tile"
import { STATE_ICON } from "@/components/admin/asset-state"
import { requestMediaRelease } from "@/modules/media/owner-media-actions"
import type { HubAppointment } from "@/modules/media/asset-hub"
import {
  ASSET_STATE_LABEL,
  ASSET_STATE_TOOLTIP,
  PUBLISHABLE_PURPOSES,
  canRequestRelease,
} from "@/shared/asset-state"
import { RELEASE_PURPOSES } from "@/shared/media-release"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"
import { cn } from "@/shared/cn"

const PURPOSE_LABEL: Record<string, string> = {
  website: "Website",
  social: "Social",
  education: "Teaching",
}

/** The client's answer, in the client's terms rather than the column's. */
const ANSWER_LABEL: Record<string, string> = {
  none: "not asked",
  requested: "waiting",
  granted: "allowed",
  declined: "said no",
  withdrawn: "taken back",
}

const ANSWER_VARIANT: Record<string, "outline" | "success" | "warning"> = {
  none: "outline",
  requested: "warning",
  granted: "success",
  declined: "outline",
  withdrawn: "warning",
}

/**
 * One appointment: who and when, the permissions the client gave for it, and the
 * photos it produced.
 *
 * Permission sits here and only here. It is stored per (booking, purpose), so
 * one answer covers every photo below — showing it on each photo made a single
 * client decision look like a dozen, and made a photo appear to have been
 * "declined" when it was the appointment that had been.
 */
export function HubAppointmentCard({
  appointment,
  clientName,
  now,
  highlight,
  showClient = true,
}: {
  appointment: HubAppointment
  clientName: string
  now: number
  highlight?: string | null
  showClient?: boolean
}) {
  const { pending, run } = useActionRunner()
  const { bookingId, releases, photos, state } = appointment
  const { Icon: StateIcon, className: stateClass } = STATE_ICON[state]

  const serviceName =
    appointment.serviceNameEn ?? appointment.serviceNameDk ?? "Appointment"
  const when = appointment.startIso
    ? formatStudioDayMonthYear(Date.parse(appointment.startIso), ADMIN_LOCALE)
    : null
  const askable = PUBLISHABLE_PURPOSES.filter((p) =>
    canRequestRelease(releases[p]),
  )

  return (
    <li className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-functional text-sm text-foreground">
            {showClient ? `${clientName} · ` : ""}
            {serviceName}
          </p>
          <p className="font-functional text-xs text-muted-foreground">
            {when ? `${when} · ` : ""}
            {appointment.ref ? `#${appointment.ref}` : "not linked to an appointment"}
            {" · "}
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`}
          </p>
        </div>
        <span
          title={ASSET_STATE_TOOLTIP[state]}
          className="flex shrink-0 items-center gap-1.5 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground"
        >
          <StateIcon className={cn("size-3.5", stateClass)} />
          {ASSET_STATE_LABEL[state]}
        </span>
      </div>

      {!bookingId ? (
        <BodySm className="text-xs text-warning">
          These photos aren’t linked to an appointment. Permission is asked per
          appointment, so they can’t be used anywhere — re-add them from the
          appointment they belong to.
        </BodySm>
      ) : (
        <div className="space-y-2 rounded-sm bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
              What the client allows
            </span>
            {askable.length === PUBLISHABLE_PURPOSES.length ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => requestMediaRelease(bookingId, [...askable]))
                }
              >
                Ask for website &amp; social
              </Button>
            ) : null}
          </div>

          {RELEASE_PURPOSES.map((purpose) => {
            const answer = releases[purpose] ?? "none"
            return (
              <div
                key={purpose}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-functional text-sm text-foreground">
                  {PURPOSE_LABEL[purpose]}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={ANSWER_VARIANT[answer] ?? "outline"} size="xs">
                    {ANSWER_LABEL[answer] ?? answer}
                  </Badge>
                  {/* Teaching is asked for on the emailed permission page and
                      publishes nothing here, so the hub reports it, never asks. */}
                  {purpose !== "education" && canRequestRelease(answer) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => requestMediaRelease(bookingId, [purpose]))
                      }
                    >
                      {answer === "none" ? "Ask" : "Ask again"}
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo) => (
          <HubPhotoTile
            key={photo.mediaId}
            photo={photo}
            releases={releases}
            now={now}
            autoOpen={highlight != null && photo.mediaId === highlight}
          />
        ))}
      </ul>
    </li>
  )
}
