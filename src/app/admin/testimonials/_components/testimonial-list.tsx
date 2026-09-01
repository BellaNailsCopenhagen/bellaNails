"use client"

import { Badge } from "@/components/ui/badge"
import { ConfirmActionButton } from "@/components/ui/confirm-action-button"
import { EmptyState } from "@/components/ui/empty-state"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import {
  cardActionDestructive,
  cardActionNeutral,
} from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  declineTestimonial,
  setTestimonialVisible,
} from "@/modules/testimonials/actions"
import type { AdminTestimonial } from "@/modules/testimonials"
import { contactDisplayName, type ClientContact } from "@/shared/contact"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * The curation list: what has been written, and who still owes a few words.
 * The visibility checkbox is the whole point — it is the only control in the app
 * that puts a client's words on the home page.
 */

// One label per state, so the badge and the controls can't disagree.
const BADGE: Record<
  AdminTestimonial["state"],
  { tone: "success" | "outline" | "destructive"; label: string }
> = {
  showing: { tone: "success", label: "On the home page" },
  waiting: { tone: "outline", label: "Not showing" },
  takenDown: { tone: "destructive", label: "Taken down by the client" },
  removed: { tone: "outline", label: "Removed" },
  erased: { tone: "destructive", label: "Erased at their request" },
}

// Why a row has no controls left. Closing a row the client already ended would
// overwrite their decision, so `declineTestimonial` refuses these too.
const CLOSED_NOTE: Partial<Record<AdminTestimonial["state"], string>> = {
  takenDown: "They retracted permission — only they can put it back.",
  erased: "They asked us to erase the words, so there is nothing left to show.",
  removed: "You removed this one.",
}

const dayOf = (iso: string) =>
  formatStudioDayMonthYear(Date.parse(iso), ADMIN_LOCALE)

export function TestimonialList({
  submitted,
  pending,
  contacts,
}: {
  submitted: AdminTestimonial[]
  pending: AdminTestimonial[]
  contacts: Record<string, ClientContact>
}) {
  if (!submitted.length && !pending.length) {
    return (
      <EmptyState
        title="No testimonials yet"
        body="Ask a client from their page — “Ask for a few words”. They get a link by email and in their own space."
      />
    )
  }

  return (
    <div className="space-y-8">
      {submitted.length ? (
        <section className="space-y-3">
          <Eyebrow as="h2">Written</Eyebrow>
          <div className="space-y-3">
            {submitted.map((item) => (
              <WrittenCard
                key={item.id}
                item={item}
                contact={contacts[item.clientId]}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pending.length ? (
        <section className="space-y-3">
          <Eyebrow as="h2">Waiting on the client</Eyebrow>
          <div className="space-y-3">
            {pending.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                contact={contacts[item.clientId]}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** One written testimonial. Each card runs its own action, so a slow save
    doesn't freeze the whole list. */
function WrittenCard({
  item,
  contact,
}: {
  item: AdminTestimonial
  contact?: ClientContact
}) {
  const { pending: busy, run } = useActionRunner()
  const closedNote = CLOSED_NOTE[item.state]

  return (
    <TintedCard className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <BodySm className="text-base text-foreground">
            {item.authorName ?? contactDisplayName(contact)}
          </BodySm>
          {item.occupation ? (
            <BodySm className="text-xs text-muted-foreground">
              {item.occupation}
            </BodySm>
          ) : null}
        </div>
        <Badge variant={BADGE[item.state].tone} size="xs">
          {BADGE[item.state].label}
        </Badge>
      </div>

      {item.body ? (
        <blockquote className="border-l-2 border-border pl-4 font-editorial text-lg leading-snug text-foreground">
          {item.body}
        </blockquote>
      ) : null}

      {item.submittedAt ? (
        <BodySm className="text-xs text-muted-foreground">
          Written {dayOf(item.submittedAt)}
        </BodySm>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        {closedNote ? (
          <BodySm className="text-xs text-muted-foreground">{closedNote}</BodySm>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={item.visible}
                disabled={busy}
                onChange={(e) =>
                  run(() => setTestimonialVisible(item.id, e.target.checked))
                }
              />
              <span className="font-functional text-sm text-foreground">
                Show on the home page
              </span>
            </label>
            <ConfirmActionButton
              action={() => declineTestimonial(item.id)}
              trigger={
                <button type="button" className={cardActionDestructive()}>
                  Remove
                </button>
              }
              labels={{
                title: "Remove this testimonial?",
                body: "It comes off the home page and out of the pool you choose from. The client keeps their own copy, and you can't put it back — you'd have to ask them again.",
                confirm: "Remove",
                confirming: "Removing…",
                cancel: "Keep it",
                failed: "Couldn't remove — try again.",
              }}
            />
          </>
        )}
      </div>
    </TintedCard>
  )
}

/** An invitation still waiting on the client. */
function PendingCard({
  item,
  contact,
}: {
  item: AdminTestimonial
  contact?: ClientContact
}) {
  return (
    <TintedCard className="space-y-2">
      <BodySm className="text-base text-foreground">
        {contactDisplayName(contact)}
      </BodySm>
      <BodySm className="text-xs text-muted-foreground">
        Asked {dayOf(item.requestedAt)}
      </BodySm>
      <div className="border-t border-border pt-2">
        <ConfirmActionButton
          action={() => declineTestimonial(item.id)}
          trigger={
            <button type="button" className={cardActionNeutral()}>
              Withdraw the invitation
            </button>
          }
          labels={{
            title: "Withdraw this invitation?",
            body: "Their link stops working. You can ask again afterwards.",
            confirm: "Withdraw",
            confirming: "Withdrawing…",
            cancel: "Leave it open",
            failed: "Couldn't withdraw — try again.",
          }}
        />
      </div>
    </TintedCard>
  )
}
