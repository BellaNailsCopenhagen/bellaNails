"use client"

import Link from "next/link"
import { Check, X } from "lucide-react"

import { BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  dismissNotification,
  setNotificationRead,
} from "@/modules/notifications/actions"
import type { OwnerNotification } from "@/modules/notifications/reads"
import { routes } from "@/shared/routes"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const PURPOSE_LABEL: Record<string, string> = {
  website: "website",
  social: "social",
}

function describe(n: OwnerNotification): string {
  if (n.kind === "media_consent_withdrawn") {
    const where = PURPOSE_LABEL[n.purpose ?? ""] ?? "publishing"
    return `withdrew ${where} permission for a photo`
  }
  if (n.kind === "shared_image_deleted") return "deleted a photo they had shared"
  if (n.kind === "media_consent_restored") {
    const where = PURPOSE_LABEL[n.purpose ?? ""] ?? "publishing"
    return `allowed ${where} again`
  }
  if (n.kind === "booking_request") return "sent a booking request"
  if (n.kind === "design_request") return "wrote in about a design"
  if (n.kind === "testimonial_submitted") return "wrote you a few words"
  return "sent an update"
}

/** The helper line — kind-specific, so a booking request never inherits the
    consent-withdrawal copy. `warn` = needs manual action. */
function helper(n: OwnerNotification): { text: string; warn?: boolean } | null {
  if (n.kind === "shared_image_deleted") {
    return {
      text: "Fully removed — check any showcases or social posts that used it.",
      warn: true,
    }
  }
  if (n.kind === "media_consent_withdrawn") {
    return n.purpose === "social"
      ? {
          text: "Remove it from your social posts — the website copy is already gone.",
          warn: true,
        }
      : { text: "The website copy has been removed automatically." }
  }
  if (n.kind === "booking_request") {
    return { text: "Awaiting your review — approve or decline it." }
  }
  if (n.kind === "design_request") {
    return { text: "Waiting on you — read it and make an offer." }
  }
  if (n.kind === "testimonial_submitted") {
    return { text: "Read it, and switch it on if you'd like it on the home page." }
  }
  if (n.kind === "media_consent_restored") {
    // Withdrawal deleted the public copy, so permission alone changes nothing
    // on the site until it is placed again.
    return { text: "You can publish from this appointment again — re-place it in the hub." }
  }
  return null
}

// A withdrawal opens the image in the asset hub; a booking request opens the
// home queue; everything else goes to the client.
function hrefFor(n: OwnerNotification): string {
  if (n.kind === "media_consent_withdrawn" && n.clientMediaId) {
    return routes.admin.assetHighlight(n.clientMediaId)
  }
  if (n.kind === "media_consent_restored") return routes.admin.assets
  if (n.kind === "booking_request" || n.kind === "design_request") {
    return routes.admin.home
  }
  if (n.kind === "testimonial_submitted") return routes.admin.testimonials
  return routes.admin.client(n.clientId)
}

const iconButton =
  "rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"

/** One notification with per-item control: mark read (when unread) + dismiss.
    Booking requests handled from the email won't clear themselves, so the artist
    needs to resolve them here. */
export function NotificationRow({
  notification: n,
  clientName,
}: {
  notification: OwnerNotification
  clientName: string
}) {
  const { pending, run } = useActionRunner()
  const h = helper(n)
  const unread = !n.readAt

  return (
    <li className="flex items-start justify-between gap-2 border-b border-border py-3">
      <Link href={hrefFor(n)} className="min-w-0 flex-1 space-y-1">
        <p className="font-functional text-sm text-foreground">
          <span className="font-medium">{clientName}</span> {describe(n)}
          {unread ? (
            <span className="ml-2 inline-block size-1.5 rounded-full bg-secondary align-middle" />
          ) : null}
        </p>
        {h ? (
          <BodySm className={`text-xs ${h.warn ? "text-destructive/80" : ""}`}>
            {h.text}
          </BodySm>
        ) : null}
        <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
          {formatStudioDayMonthYear(new Date(n.createdAt).getTime(), ADMIN_LOCALE)}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5">
        {unread ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setNotificationRead(n.id, true))}
            aria-label="Mark read"
            title="Mark read"
            className={iconButton}
          >
            <Check className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => dismissNotification(n.id))}
          aria-label="Dismiss"
          title="Dismiss"
          className={iconButton}
        >
          <X className="size-4" />
        </button>
      </div>
    </li>
  )
}
