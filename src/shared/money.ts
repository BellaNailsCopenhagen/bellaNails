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

/**
 * Read an amount the way she would type it.
 *
 * Danish writes 1.200,50; English 1,200.50 — and `Number("1.200")` is 1.2, so a
 * naive parse turned 1200 kr into 120 øre and toasted "Saved". The LAST
 * separator is the decimal one if it leaves two digits behind it; every other
 * dot and comma is grouping and goes.
 */
export function parseKroner(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "")
  if (!raw) {
    return null
  }
  if (!/^[0-9.,]+$/.test(raw)) {
    return null
  }

  const lastSeparator = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."))
  const decimals = lastSeparator === -1 ? 0 : raw.length - lastSeparator - 1
  const isDecimal = lastSeparator !== -1 && decimals > 0 && decimals <= 2

  const digits = isDecimal
    ? `${raw.slice(0, lastSeparator).replace(/[.,]/g, "")}.${raw.slice(lastSeparator + 1)}`
    : raw.replace(/[.,]/g, "")

  const value = Number(digits)
  if (!Number.isFinite(value) || value < 0) {
    return null
  }

  // Round to øre — a third decimal is a typo, not a price.
  return Math.round(value * 100) / 100
}
