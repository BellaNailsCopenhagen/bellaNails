"use client"

import { useState } from "react"
import { Ban } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionButton } from "@/components/ui/confirm-action-button"
import { Input } from "@/components/ui/input"
import { BodySm } from "@/components/ui/typography"
import { cardActionDestructive } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  blockIdentity,
  unblockIdentity,
} from "@/modules/booking/protection-actions"
import {
  BLOCK_KINDS,
  type BlockedIdentityView,
  type BlockKind,
} from "@/shared/booking-protection"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const KIND_COPY: Record<BlockKind, { label: string; placeholder: string }> = {
  email: { label: "This person", placeholder: "name@example.com" },
  domain: { label: "A whole email provider", placeholder: "mailinator.com" },
  ip: { label: "This connection", placeholder: "203.0.113.42" },
}

/**
 * The manual blocklist — for the handful of people who have proven what they
 * are. Blocks by address, by email provider (the throwaway-inbox case), or by
 * the connection they booked from.
 *
 * It lives under Clients rather than App settings because it is a list of
 * PEOPLE, not a configuration: the other way round, you would go looking for
 * someone you had blocked and not find them anywhere near the clients.
 *
 * A blocked booking is refused without saying which of the three matched: told
 * "your email is blocked", someone just uses another one.
 */
export function Blocklist({ entries }: { entries: BlockedIdentityView[] }) {
  const { pending, run } = useActionRunner()
  const [kind, setKind] = useState<BlockKind>("email")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState("")

  const add = () =>
    run(async () => {
      const result = await blockIdentity({ kind, value, reason })
      if (result.ok) {
        setValue("")
        setReason("")
      }
      return result
    })

  return (
    <div className="space-y-4">
      <BodySm className="text-xs">
        People who can no longer book or send a request online. They see “we
        can’t take this online — please contact the studio”, which is also true:
        you can still book them in yourself if you change your mind.
      </BodySm>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <fieldset className="space-y-2">
          <legend className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
            What are you blocking?
          </legend>
          {BLOCK_KINDS.map((option) => (
            <label key={option} className="flex items-center gap-2.5">
              <input
                type="radio"
                name="block-kind"
                checked={kind === option}
                onChange={() => setKind(option)}
                className="size-4"
              />
              <span className="font-functional text-sm text-foreground">
                {KIND_COPY[option].label}
              </span>
            </label>
          ))}
        </fieldset>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={KIND_COPY[kind].placeholder}
          aria-label="What to block"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Booked four times and never came, ignored two messages"
          aria-label="Why"
        />
        {/* Required — you will read this in six months and need to know. */}
        <BodySm className="text-xs">
          The reason is required, and only you ever see it.
        </BodySm>

        <Button
          size="sm"
          disabled={pending || !value.trim() || !reason.trim()}
          onClick={add}
        >
          <Ban className="size-3.5" />
          Block
        </Button>
      </div>

      {entries.length ? (
        <ul className="border-t border-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 border-b border-border py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" size="xs">
                    {entry.kind}
                  </Badge>
                  <span className="truncate font-functional text-sm text-foreground">
                    {entry.value}
                  </span>
                </div>
                <BodySm className="text-xs">{entry.reason}</BodySm>
                <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                  {formatStudioDayMonthYear(
                    Date.parse(entry.createdAt),
                    ADMIN_LOCALE,
                  )}
                </p>
              </div>
              <ConfirmActionButton
                action={() => unblockIdentity(entry.id)}
                trigger={
                  <button type="button" className={cardActionDestructive()}>
                    Unblock
                  </button>
                }
                labels={{
                  title: "Unblock this one?",
                  body: `${entry.value} will be able to book online again. You can always block it back.`,
                  confirm: "Unblock",
                  confirming: "Removing…",
                  cancel: "Keep blocked",
                  failed: "Couldn’t remove that.",
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">Nobody is blocked.</BodySm>
      )}
    </div>
  )
}
