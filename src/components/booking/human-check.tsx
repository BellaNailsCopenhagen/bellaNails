"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { BodySm } from "@/components/ui/typography"
import { requestHumanChallenge } from "@/modules/identity/human-check-actions"
import {
  encodeHumanProof,
  solveHumanChallenge,
  type HumanChallenge,
} from "@/shared/human-check"

export type HumanCheckLabels = {
  /** The unticked prompt. */
  prompt: string
  working: string
  done: string
  failed: string
  /** The one-line "where does this go" reassurance under the box. */
  note: string
}

/** `done` is NOT here: whether the check is satisfied is the parent's `proof`,
    so clearing that (a spent proof, a failed submit) brings the box back to
    idle instead of leaving it ticked and unclickable. */
type State = "idle" | "working" | "failed"

/**
 * The "I'm not a robot" box. Always visible, and deliberately a tick rather
 * than something that solves itself on load: it is a step the client takes, so
 * it should look like one.
 *
 * Ticking fetches a signed challenge and brute-forces the number it hides
 * (~50k hashes — under a second on a phone, real money at scale). The solved
 * proof goes up to the parent, which sends it with the booking; the server
 * re-checks the signature, the expiry, the work and that the proof is unspent.
 *
 * Nothing leaves this app: the challenge comes from our own server action, so
 * there is no third-party script, no cookie and no processor to disclose.
 */
export function HumanCheck({
  labels,
  proof,
  onSolved,
}: {
  labels: HumanCheckLabels
  /** The solved proof the parent is holding — null means "not done". */
  proof: string | null
  onSolved: (proof: string | null) => void
}) {
  const [state, setState] = useState<State>("idle")
  const [progress, setProgress] = useState(0)

  const solve = async () => {
    setState("working")
    setProgress(0)
    onSolved(null)
    try {
      const challenge: HumanChallenge | null = await requestHumanChallenge()
      // Only null when the server has no signing secret — in which case the
      // parent doesn't render this box at all, and the action passes the check
      // rather than blocking a client on something they can't fix.
      if (!challenge) {
        setState("idle")

        return
      }
      const number = await solveHumanChallenge(challenge, (fraction) => {
        setProgress(fraction)

        // Yield so the spinner actually spins on a slow device.
        return new Promise((resolve) => setTimeout(resolve, 0))
      })
      if (number === null) {
        setState("failed")

        return
      }
      onSolved(
        encodeHumanProof({
          algorithm: challenge.algorithm,
          challenge: challenge.challenge,
          salt: challenge.salt,
          signature: challenge.signature,
          number,
        }),
      )
      setState("idle")
    } catch {
      setState("failed")
    }
  }

  const done = proof !== null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={done || state === "working" ? undefined : solve}
        aria-pressed={done}
        disabled={state === "working"}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-progress"
      >
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center rounded-sm border ${
            done
              ? "border-foreground bg-foreground text-background"
              : "border-border"
          }`}
        >
          {done ? (
            <Check className="size-3.5" />
          ) : state === "working" ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
        </span>
        <span className="min-w-0 font-functional text-sm text-foreground">
          {state === "working"
            ? `${labels.working} ${Math.round(progress * 100)}%`
            : done
              ? labels.done
              : state === "failed"
                ? labels.failed
                : labels.prompt}
        </span>
      </button>
      <BodySm className="text-xs">{labels.note}</BodySm>
    </div>
  )
}
