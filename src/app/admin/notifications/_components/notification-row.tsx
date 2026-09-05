"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { X } from "lucide-react"

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
  education: "teaching",
}

/** What happened, and what it wants — one entry per kind so a booking request
    can never inherit the consent-withdrawal copy. `warn` = act by hand. */
const COPY: Record<
  string,
  { line: string; helper?: string; warn?: boolean }
> = {
  shared_image_deleted: {
    line: "deleted a photo they had shared",
    helper: "Fully removed — check any showcases or social posts that used it.",
    warn: true,
  },
  booking_request: {
    line: "sent a booking request",
    helper: "Awaiting your review — approve or decline it.",
  },
  design_request: {
    line: "wrote in about a design",
    helper: "Waiting on you — read it and make an offer.",
  },
  design_reply: {
    line: "wrote back on a design",
    helper: "Waiting on you — read it and answer.",
  },
  testimonial_submitted: {
    line: "wrote you a few words",
    helper: "Read it, and switch it on if you'd like it on the home page.",
  },
  media_consent_offered: {
    line: "offered a set you hadn't asked about",
    helper: "Permission is granted — pick the shots and place them in the hub.",
  },
  media_consent_restored: {
    line: "allowed publishing again",
    // Withdrawal deleted the public copy, so permission alone changes nothing
    // on the site until it is placed again.
    helper: "You can publish from this appointment again — re-place it in the hub.",
  },
}

function copyFor(n: OwnerNotification): { line: string; helper?: string; warn?: boolean } {
  // The two consent kinds read their purpose out of the row, so they can't be
  // plain table entries.
  const where = PURPOSE_LABEL[n.purpose ?? ""] ?? "publishing"
  if (n.kind === "media_consent_withdrawn") {
    return n.purpose === "social"
      ? {
          line: `withdrew ${where} permission for a photo`,
          helper: "Remove it from your social posts — the website copy is already gone.",
          warn: true,
        }
      : {
          line: `withdrew ${where} permission for a photo`,
          helper: "The website copy has been removed automatically.",
        }
  }
  if (n.kind === "media_consent_restored") {
    return { ...COPY.media_consent_restored, line: `allowed ${where} again` }
  }
  if (n.kind === "media_consent_offered") {
    return { ...COPY.media_consent_offered, line: `offered you ${where}` }
  }
  return COPY[n.kind] ?? { line: "sent an update" }
}

/** The anchor each kind lands on. Prefixes must match the card that renders the
    `id` — design-request-card, admin-request-card, testimonial-list. */
const FOCUS: Record<string, (targetId: string) => string> = {
  booking_request: (id) => routes.admin.homeFocus(`request-${id}`),
  design_request: (id) => routes.admin.homeFocus(`design-${id}`),
  design_reply: (id) => routes.admin.homeFocus(`design-${id}`),
  testimonial_submitted: (id) => routes.admin.testimonialFocus(id),
}

/** Where the page falls back to when there is no target to land on (a
    pre-migration row, or a kind that has no single item). */
const FALLBACK: Record<string, string> = {
  booking_request: routes.admin.home,
  design_request: routes.admin.home,
  design_reply: routes.admin.home,
  testimonial_submitted: routes.admin.testimonials,
  media_consent_restored: routes.admin.assets,
  media_consent_offered: routes.admin.assets,
}

function hrefFor(n: OwnerNotification): string {
  if (n.kind === "media_consent_withdrawn" && n.clientMediaId) {
    return routes.admin.assetHighlight(n.clientMediaId)
  }
  const focused = n.targetId ? FOCUS[n.kind]?.(n.targetId) : undefined
  return focused ?? FALLBACK[n.kind] ?? routes.admin.client(n.clientId)
}

const iconButton =
  "shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"

/** A modified click is the browser's to handle — never hijack "open in a new
    tab" to run a server action. */
const opensElsewhere = (e: React.MouseEvent) =>
  e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0

/**
 * One notification. Opening it IS reading it: the row marks itself read on the
 * way out, so the feed drains by being used rather than by being tidied. The ×
 * is for the ones handled elsewhere (a booking request answered from the email)
 * that never get opened here at all.
 *
 * Still a real link — cmd-click, prefetch and the link role all matter on a
 * list whose whole job is going somewhere.
 */
export function NotificationRow({
  notification: n,
  clientName,
}: {
  notification: OwnerNotification
  clientName: string
}) {
  const router = useRouter()
  const [navigating, startNavigation] = useTransition()
  const { pending, run } = useActionRunner()
  const { line, helper, warn } = copyFor(n)
  const unread = !n.readAt
  const href = hrefFor(n)

  // Read-then-navigate, so the badge is already right when the page it opens
  // renders. An unread that won't mark still opens — the alert is the point.
  const open = (e: React.MouseEvent) => {
    if (opensElsewhere(e) || !unread) return
    e.preventDefault()
    startNavigation(async () => {
      await setNotificationRead(n.id, true).catch(() => null)
      router.push(href)
    })
  }

  return (
    <li className="flex items-start justify-between gap-2 border-b border-border py-3">
      <Link
        href={href}
        onClick={open}
        aria-busy={navigating}
        className="min-w-0 flex-1 space-y-1"
      >
        <p className="font-functional text-sm text-foreground">
          <span className="font-medium">{clientName}</span> {line}
          {unread ? (
            <span className="ml-2 inline-block size-1.5 rounded-full bg-secondary align-middle" />
          ) : null}
        </p>
        {helper ? (
          <BodySm className={`text-xs ${warn ? "text-destructive/80" : ""}`}>
            {helper}
          </BodySm>
        ) : null}
        <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
          {formatStudioDayMonthYear(new Date(n.createdAt).getTime(), ADMIN_LOCALE)}
        </p>
      </Link>

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
    </li>
  )
}
