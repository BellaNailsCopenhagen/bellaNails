import { Label } from "@/components/ui/label"
import { cn } from "@/shared/cn"

/** The admin sheets' field-label treatment — passed to `Label`'s className so
    every form in /admin reads the same. */
export const fieldLabel = "text-[10px] tracking-widest-lux"

/**
 * An admin field's label, with the one thing the labels never said: whether
 * she has to fill it in.
 *
 * `required` marks the fields the server action refuses without — so it is the
 * server's rule on screen, not a second opinion about it. Everything else is
 * genuinely optional, and where that is worth saying out loud the label says
 * "(optional)" in its own text, the way the booking form's notes field does.
 *
 * The asterisk is `aria-hidden` and the input carries `aria-required` instead:
 * a screen reader should hear "required", not "asterisk". These sheets save on
 * a button press rather than a form submit, so native `required` would never
 * fire — the disabled Save button is still what actually prevents a bad write,
 * and this is what tells her why it is disabled.
 */
export function FieldLabel({
  htmlFor,
  required = false,
  className,
  children,
}: {
  htmlFor?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className={cn(fieldLabel, className)}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
      ) : null}
    </Label>
  )
}

/**
 * "* required" — put it once near a sheet's Save button so the asterisks above
 * are explained rather than assumed. An asterisk is a near-universal
 * convention, but only once something has said what it means.
 */
export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="text-destructive">
        *
      </span>{" "}
      required
    </p>
  )
}
