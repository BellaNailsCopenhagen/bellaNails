/**
 * Testimonials — the client's own words, published only when the studio chooses
 * them. Distinct from `reviews` (per-service, studio-entered, text + stars).
 *
 * **Client components must not import this** — it is transitively
 * `server-only`. They import `./actions` directly.
 */
export {
  getMyTestimonialSpace,
  getPublishedTestimonials,
  getTestimonialInviteByToken,
  getTestimonialsForAdmin,
  type AdminTestimonial,
  type MyTestimonial,
  type MyTestimonialInvite,
} from "./reads"
