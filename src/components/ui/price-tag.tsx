import * as React from "react"

import { cn } from "@/shared/cn"
import { formatPrice } from "@/shared/money"

/**
 * Prices are stored in cents (per the schema). PriceTag renders them in the
 * editorial face via the canonical `formatPrice` — e.g. 65000 → "650,00 kr.",
 * with `sign` adding the locale's "+"/"−" for add-on deltas.
 */
type PriceTagProps = React.ComponentProps<"span"> & {
  /** Amount in cents (e.g. `65000` → "650,00 kr."). */
  cents: number
  /** BCP-47 locale for formatting. Defaults to `da-DK`. */
  locale?: string
  /** Show an explicit "+"/"−" — for add-on deltas ("+50,00 kr."). */
  sign?: boolean
  /** ISO 4217 currency code. Defaults to `DKK`. */
  currency?: string
}

function PriceTag({
  cents,
  locale = "da-DK",
  sign = false,
  currency = "DKK",
  className,
  ...props
}: PriceTagProps) {
  return (
    <span
      data-slot="price-tag"
      className={cn("font-editorial", className)}
      {...props}
    >
      {formatPrice(cents, locale, currency, sign)}
    </span>
  )
}

export { PriceTag }
export type { PriceTagProps }
