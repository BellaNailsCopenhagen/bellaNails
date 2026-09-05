/**
 * Normalise a `?next=` / `?redirect_url=` value to a path on THIS site.
 *
 * The obvious guard — `startsWith("/") && !startsWith("//")` — is not enough:
 * WHATWG treats a backslash as a slash for http(s), so `/\evil.com` passes it
 * and then resolves to `https://evil.com/`. Parsing and comparing the origin is
 * the check that actually holds, and it keeps the query string the booking flow
 * depends on.
 */

// Any absolute base works — it exists only to be compared against.
const BASE = "https://internal.invalid"

export function safeInternalPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/"
  try {
    const url = new URL(raw, BASE)
    if (url.origin !== BASE) return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}
