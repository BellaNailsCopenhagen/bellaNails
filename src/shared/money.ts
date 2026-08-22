/**
 * Canonical price formatting — prices are integer cents (per the schema),
 * rendered in the standard Danish currency face, e.g. 65000 → "650,00 kr.".
 * The one formatter for every surface (booking UI via PriceTag + emails);
 * `sign` adds the "+"/"−" for add-on deltas.
 */
export function formatPrice(
  cents: number,
  locale = "da-DK",
  currency = "DKK",
  sign = false,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay: sign ? "always" : "auto",
  }).format(cents / 100)
}
