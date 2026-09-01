/**
 * Testimonial rules, shared by the client's form, the server action and the home
 * section. Client-safe.
 */

/**
 * The lifecycle. `visible` is a separate axis — the studio's switch — so a
 * submitted testimonial stays private until the studio chooses it.
 *
 * `declined` and `withdrawn` are deliberately different words: declined is the
 * studio's curation, withdrawn is the client's right (Art. 7(3)). A withdrawal
 * overrides the switch; a decline must not read as though the client asked.
 */
export const TESTIMONIAL_STATUSES = [
  "requested",
  "submitted",
  "declined",
  "withdrawn",
] as const
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number]

export const asTestimonialStatus = (value: string): TestimonialStatus =>
  (TESTIMONIAL_STATUSES as readonly string[]).includes(value)
    ? (value as TestimonialStatus)
    : "requested"

/**
 * Bump when the consent wording below changes materially. Stored on the row at
 * submission so we can show exactly what a given person agreed to, and when
 * (Art. 7(1) accountability) — the same reason `media_releases` carries one.
 */
export const TESTIMONIAL_CONSENT_VERSION = "2026-09-v1"

// "A short text" — long enough for a real sentiment, short enough to read at a
// glance in the home section, which is where every one of these ends up.
export const TESTIMONIAL_MIN_BODY = 20
export const TESTIMONIAL_MAX_BODY = 300
export const TESTIMONIAL_MAX_NAME = 60
export const TESTIMONIAL_MAX_OCCUPATION = 60

/**
 * How many published testimonials the home section needs before it appears. One
 * quote reads as thin — two reads as a pattern.
 */
export const TESTIMONIALS_MIN_TO_SHOW = 2

/**
 * Above this, the section switches from a static row to a horizontal scroller.
 * At three or fewer they all fit side by side on a desktop row.
 */
export const TESTIMONIALS_SCROLL_ABOVE = 3

/** How many the home section renders at most. Beyond this they are simply not
    shown, so the admin count has to say so rather than imply otherwise. */
export const TESTIMONIALS_DISPLAY_LIMIT = 12

export const shouldShowTestimonials = (count: number): boolean =>
  count >= TESTIMONIALS_MIN_TO_SHOW

export const shouldScrollTestimonials = (count: number): boolean =>
  count > TESTIMONIALS_SCROLL_ABOVE

/**
 * What a testimonial IS, to whoever is looking. One derived value instead of
 * `status` + `visible` + `withdrawn_at` + `content_erased_at` read four
 * different ways — that spread is what let the admin count and the home read
 * disagree.
 */
export const TESTIMONIAL_STATES = [
  "waiting", // written, the studio hasn't switched it on
  "showing", // live on the home page
  "takenDown", // the client retracted; they can put it back
  "removed", // the studio won't be showing it
  "erased", // the client had the words deleted
] as const
export type TestimonialState = (typeof TESTIMONIAL_STATES)[number]

export function testimonialState(row: {
  status: string
  visible: boolean
  content_erased_at?: string | null
}): TestimonialState {
  if (row.content_erased_at) return "erased"
  if (row.status === "withdrawn") return "takenDown"
  if (row.status === "declined") return "removed"
  return row.visible && row.status === "submitted" ? "showing" : "waiting"
}

/** A published testimonial, as any surface renders it. Here rather than in the
    module, because the module is server-only and a client component may need it. */
export type PublishedTestimonial = {
  id: string
  authorName: string
  occupation: string | null
  body: string
}

/** What the client typed, validated. Trimmed values come back out so the caller
    persists exactly what was checked. */
export type TestimonialSubmission = {
  authorName: string
  occupation: string | null
  body: string
}

export type TestimonialValidation =
  | { ok: true; value: TestimonialSubmission }
  | {
      ok: false
      field: "authorName" | "body" | "consent"
      reason: "missing" | "tooShort" | "tooLong"
    }

export function validateTestimonial(input: {
  authorName: string
  occupation?: string | null
  body: string
  /** Must be true: publication IS the purpose, so an un-consented testimonial
      is not a thing we store. */
  consent: boolean
}): TestimonialValidation {
  if (!input.consent) return { ok: false, field: "consent", reason: "missing" }
  const authorName = input.authorName.trim()
  if (!authorName) return { ok: false, field: "authorName", reason: "missing" }
  if (authorName.length > TESTIMONIAL_MAX_NAME) {
    return { ok: false, field: "authorName", reason: "tooLong" }
  }

  const body = input.body.trim()
  if (!body) return { ok: false, field: "body", reason: "missing" }
  if (body.length < TESTIMONIAL_MIN_BODY) {
    return { ok: false, field: "body", reason: "tooShort" }
  }
  if (body.length > TESTIMONIAL_MAX_BODY) {
    return { ok: false, field: "body", reason: "tooLong" }
  }

  // Optional by design — plenty of people won't want to state one.
  const occupation = input.occupation?.trim().slice(0, TESTIMONIAL_MAX_OCCUPATION) || null

  return { ok: true, value: { authorName, occupation, body } }
}
