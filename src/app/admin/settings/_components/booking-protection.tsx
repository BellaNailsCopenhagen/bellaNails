"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  setBookingAccessLevel,
  setBookingHumanCheck,
} from "@/modules/booking/protection-actions"
import {
  BOOKING_ACCESS_LEVELS,
  isSelectableLevel,
  type BookingAccessLevel,
  type BookingProtection,
} from "@/shared/booking-protection"

/**
 * How hard it is to book — one dial, least friction at the top. Written as
 * consequences rather than mechanisms: the choice is a business one (how much
 * conversion is a quiet calendar worth), so the copy has to price it.
 */
const LEVEL_COPY: Record<
  BookingAccessLevel,
  { label: string; body: string; cost: string }
> = {
  open: {
    label: "Anyone can book",
    body: "A client types a name, an email and a phone number, and books. Nothing is verified.",
    cost: "Easiest to book · weakest protection. Someone can book with an email that isn't theirs, and you'd only find out when they don't turn up.",
  },
  verified: {
    label: "Confirm an email first",
    // No digit count: the length is a Supabase Auth setting, not ours, and the
    // four codes that arrived during QA were 8 digits while every screen said
    // 6. Copy that states a number is copy that goes stale the day it changes.
    body: "We email them a one-time code (or they use Google) before they can book. Confirming also gives them My Space, where their appointments and photos live.",
    cost: "One extra step · strong protection. Made-up addresses can't take slots. This is the recommended setting.",
  },
  card: {
    label: "Confirm an email and add a card",
    body: "As above, plus a card held on file — not charged, so a no-show can be. The strongest option, and the one that also deters no-shows.",
    cost: "Needs card payments set up before it can be switched on.",
  },
}

export function BookingProtectionSettings({
  protection,
  humanCheckAvailable,
}: {
  protection: BookingProtection
  /** False = no signing key on this deployment, so the check cannot run. */
  humanCheckAvailable: boolean
}) {
  const { pending, run } = useActionRunner()
  const [level, setLevel] = useState<BookingAccessLevel>(protection.accessLevel)
  const [humanCheck, setHumanCheck] = useState(protection.humanCheck)

  const chooseLevel = (next: BookingAccessLevel) => {
    const previous = level
    setLevel(next)
    run(async () => {
      const result = await setBookingAccessLevel(next)
      if (!result.ok) setLevel(previous)
      return result
    })
  }

  const toggleHumanCheck = (next: boolean) => {
    setHumanCheck(next)
    run(async () => {
      const result = await setBookingHumanCheck(next)
      if (!result.ok) setHumanCheck(!next)
      return result
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow as="h2">Booking protection</Eyebrow>
        <BodySm className="text-xs">
          Every step up here makes booking safer and slightly harder. Start
          where you are comfortable — you can tighten it the day you see a
          problem, and loosen it again after.
        </BodySm>
      </div>

      <ul className="space-y-3">
        {BOOKING_ACCESS_LEVELS.map((option) => {
          const copy = LEVEL_COPY[option]
          const available = isSelectableLevel(option)
          return (
            <li
              key={option}
              className={`rounded-lg border p-4 ${
                level === option ? "border-foreground" : "border-border"
              } ${available ? "" : "opacity-60"}`}
            >
              <label
                className={`flex items-start gap-3 ${available ? "" : "cursor-not-allowed"}`}
              >
                <input
                  type="radio"
                  name="booking-access-level"
                  checked={level === option}
                  disabled={pending || !available}
                  onChange={() => chooseLevel(option)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-functional text-sm font-medium text-foreground">
                      {copy.label}
                    </span>
                    {option === "verified" ? (
                      <Badge variant="success" size="xs">
                        Recommended
                      </Badge>
                    ) : null}
                    {available ? null : (
                      <Badge variant="outline" size="xs">
                        Not available yet
                      </Badge>
                    )}
                  </span>
                  <span className="block font-functional text-xs text-muted-foreground">
                    {copy.body}
                  </span>
                  <span className="block font-functional text-xs text-muted-foreground">
                    {copy.cost}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div
        className={`rounded-lg border border-border p-4 ${
          humanCheckAvailable ? "" : "opacity-60"
        }`}
      >
        <label
          className={`flex items-start gap-3 ${
            humanCheckAvailable ? "" : "cursor-not-allowed"
          }`}
        >
          {/* Her choice stays ticked when the check can't run — it is a real
              preference and it takes effect the moment the key is set. What
              changes is that the card stops implying it is doing something. */}
          <input
            type="checkbox"
            checked={humanCheck}
            disabled={pending || !humanCheckAvailable}
            onChange={(e) => toggleHumanCheck(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-functional text-sm font-medium text-foreground">
                “I’m not a robot” box
              </span>
              {humanCheckAvailable ? null : (
                <Badge variant="outline" size="xs">
                  Not running
                </Badge>
              )}
            </span>
            {humanCheckAvailable ? null : (
              <span className="block font-functional text-xs text-destructive">
                This deployment has no signing key for the check, so clients are
                never shown the box and bookings are never asked for it. Your
                choice here is saved and starts working the moment the key is
                set.
              </span>
            )}
            {!humanCheckAvailable && level === "open" ? (
              <span className="block font-functional text-xs text-destructive">
                With “Anyone can book” selected and this not running, nothing at
                all is checking who books — a script could take every slot.
              </span>
            ) : null}
            <span className="block font-functional text-xs text-muted-foreground">
              A box the client ticks on the booking form. It stops scripted
              booking; a determined person can still get past it. Worth leaving
              on whatever level you pick above — and essential if you choose
              “Anyone can book”.
            </span>
            <span className="block font-functional text-xs text-muted-foreground">
              Runs entirely on our own server — no Google, no tracking, no
              cookie, nothing shared with anyone. It needs no cookie banner and
              no change to your privacy notice.
            </span>
          </span>
        </label>
      </div>
    </section>
  )
}
