/**
 * Client roster search — one rule shared by every admin client picker, so they
 * all match identically. The artist reaches for name or phone far more than
 * email, so a phone query matches whatever format the number is stored in.
 */

/** Digits only — "+45 12 34 56 78" and "12345678" both reduce to a comparable run. */
const digitsOf = (value: string) => value.replace(/\D/g, "")

/**
 * The lowercased haystack for one client: name + email as typed, plus the phone
 * reduced to digits so a phone query matches regardless of the stored format.
 */
export function clientSearchText(parts: {
  firstName?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
}): string {
  const text = [parts.firstName, parts.fullName, parts.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const phone = parts.phone ? digitsOf(parts.phone) : ""
  return phone ? `${text} ${phone}` : text
}

/**
 * Does a client's haystack match the query? Text matches as lowercased prose; a
 * query containing digits also matches the digits-only phone (3+ digits, so a
 * stray digit doesn't flood the list).
 */
export function matchesClientSearch(search: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (search.includes(q)) return true
  const digits = digitsOf(query)
  return digits.length >= 3 && search.includes(digits)
}
