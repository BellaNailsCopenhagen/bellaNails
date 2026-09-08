import "server-only"

/**
 * The studio's external review link (Google). Unset until she has a Google
 * Business profile, and `requestReview` refuses without it — so the control
 * that triggers it must not look live either.
 *
 * Same shape as `human-check`'s `secret()`: one place knows the variable name,
 * and "is this deployment able to do it" is a question anything can ask.
 */
function url(): string | null {
  return process.env.GOOGLE_REVIEW_URL || null
}

export function reviewUrl(): string | null {
  return url()
}

export function reviewLinkConfigured(): boolean {
  return url() !== null
}
