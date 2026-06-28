import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Prices are stored in cents (per the schema). PriceTag renders them in the
 * editorial face using the standard Danish currency format — e.g. 65000 →
 * "650,00 kr.", with `sign` adding the locale's "+"/"−" for add-on deltas.
 *
 * Locale defaults to `da-DK` (our market); pass the active locale once
 * next-intl lands (Phase 2) if other locales ever need their own format.
 */
function formatPrice(
  cents: number,
  locale: string,
  currency: string,
  sign: boolean,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay: sign ? "always" : "auto",
  }).format(cents / 100);
}

type PriceTagProps = React.ComponentProps<"span"> & {
  /** Amount in cents (e.g. `65000` → "650,00 kr."). */
  cents: number;
  /** BCP-47 locale for formatting. Defaults to `da-DK`. */
  locale?: string;
  /** Show an explicit "+"/"−" — for add-on deltas ("+50,00 kr."). */
  sign?: boolean;
  /** ISO 4217 currency code. Defaults to `DKK`. */
  currency?: string;
};

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
  );
}

export { PriceTag, formatPrice };
export type { PriceTagProps };
