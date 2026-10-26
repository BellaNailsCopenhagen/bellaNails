"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useActionRunner } from "@/hooks/use-action-runner"
import { setAppointmentIncome } from "@/modules/studio/income-actions"
import { formatPrice, parseKroner } from "@/shared/money"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * What this appointment actually brought in, when it wasn't the booked price —
 * a refund, a no-show fee taken, a tip, a discount given at the chair.
 *
 * The booked price is never overwritten; this sits beside it, which is why the
 * card can show both and mark the row adjusted. Closed by default: the booked
 * price is right almost every time, and a number input on every card invites
 * corrections nobody needed to make.
 */
export function IncomeOverrideField({
  bookingId,
  bookedCents,
  overrideCents,
}: {
  bookingId: string
  bookedCents: number
  overrideCents: number | null
}) {
  const { pending, run } = useActionRunner()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(
    overrideCents === null ? "" : String(overrideCents / 100),
  )

  const close = () => {
    setValue(overrideCents === null ? "" : String(overrideCents / 100))
    setOpen(false)
  }

  const save = () =>
    run(async () => {
      const kroner = parseKroner(value)
      // A typo is not an instruction to delete. Clearing is its own control, so
      // unreadable input has to fail rather than fall through to it — "1.2o0"
      // used to wipe an amount she had set and say "Back to the booked price".
      if (kroner === null) {
        return {
          ok: false as const,
          error: "That doesn’t look like an amount.",
        }
      }
      const result = await setAppointmentIncome(bookingId, kroner * 100)
      if (result.ok) {
        setOpen(false)
      }

      return result
    })

  const clear = () =>
    run(async () => {
      const result = await setAppointmentIncome(bookingId, null)
      if (result.ok) {
        setValue("")
        setOpen(false)
      }

      return result
    })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        {overrideCents === null
          ? "Set what it earned"
          : `Adjusted · booked ${formatPrice(bookedCents, ADMIN_LOCALE)}`}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        value={value}
        onValueChange={setValue}
        inputMode="decimal"
        aria-label="What this appointment earned, in kroner"
        placeholder={String(bookedCents / 100)}
        className="w-24 text-right text-sm"
      />
      <Button size="sm" disabled={pending} onClick={save}>
        Save
      </Button>
      {overrideCents === null ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={clear}
          title="Go back to the booked price"
          className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  )
}
