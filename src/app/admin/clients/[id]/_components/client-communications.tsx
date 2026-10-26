import { Eyebrow, BodySm } from "@/components/ui/typography"
import type { CommunicationView } from "@/modules/notifications"
import {
  formatStudioDayMonthYear,
  formatStudioTime,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const KIND_LABEL: Record<CommunicationView["kind"], string> = {
  confirmation: "Confirmation",
  cancellation: "Cancellation",
  reschedule: "Reschedule",
  reminder: "Reminder",
  media_release_request: "Media release request",
  review_request: "Review request",
  booking_request_received: "Booking request received",
  booking_request_declined: "Booking request declined",
  design_request_received: "Design request received",
  design_reply: "Reply about a design",
  design_offer_sent: "Offer sent",
  design_request_declined: "Design request declined",
  testimonial_request: "Testimonial request",
}

const STATUS_LABEL: Record<CommunicationView["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
}

/**
 * The client's transactional-message log (admin-only), newest first — what was
 * sent, when, how it was triggered, and whether it reached them.
 */
export function ClientCommunications({
  comms,
}: {
  comms: CommunicationView[]
}) {
  return (
    <section className="space-y-3">
      <Eyebrow as="h3">Communications</Eyebrow>
      {comms.length ? (
        <ul className="border-t border-border">
          {comms.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5"
            >
              <div className="min-w-0">
                <p className="font-functional text-sm text-foreground">
                  {KIND_LABEL[c.kind]}
                  {c.channel !== "email"
                    ? ` · ${c.channel === "in_app" ? "in-app" : c.channel}`
                    : ""}
                  {c.trigger === "manual" ? " · manual" : ""}
                </p>
                <p className="font-functional text-xs text-muted-foreground">
                  {formatStudioDayMonthYear(
                    new Date(c.createdAt).getTime(),
                    ADMIN_LOCALE,
                  )}{" "}
                  · {formatStudioTime(c.createdAt, ADMIN_LOCALE)}
                </p>
              </div>
              <span className="shrink-0 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                {STATUS_LABEL[c.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="py-2">No messages sent yet.</BodySm>
      )}
    </section>
  )
}
