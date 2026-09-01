import type { Metadata } from "next"

import { TestimonialList } from "@/app/admin/testimonials/_components/testimonial-list"
import { BackToMore } from "@/components/admin/back-to-more"
import { BodySm, Eyebrow, H2 } from "@/components/ui/typography"
import { getTestimonialsForAdmin } from "@/modules/testimonials"
import {
  TESTIMONIALS_DISPLAY_LIMIT,
  TESTIMONIALS_MIN_TO_SHOW,
  TESTIMONIALS_SCROLL_ABOVE,
} from "@/shared/testimonial"

export const metadata: Metadata = { title: "Testimonials" }
export const dynamic = "force-dynamic"

/**
 * Testimonials — the studio chooses which client words appear on the home page. The
 * switch here is the ONLY thing that publishes one; a submitted testimonial is
 * private until the studio flips it.
 */
export default async function AdminTestimonialsPage() {
  const { submitted, pending, contacts } = await getTestimonialsForAdmin()
  const onCount = submitted.filter((item) => item.state === "showing").length
  const visibleCount = Math.min(onCount, TESTIMONIALS_DISPLAY_LIMIT)
  const overCap = onCount > TESTIMONIALS_DISPLAY_LIMIT

  return (
    <div className="space-y-8">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>Home page</Eyebrow>
        <H2>Testimonials</H2>
        <BodySm className="text-xs">
          {visibleCount < TESTIMONIALS_MIN_TO_SHOW
            ? `The section is hidden until ${TESTIMONIALS_MIN_TO_SHOW} are showing — ${visibleCount} on now.`
            : `${visibleCount} showing on the home page${
                visibleCount > TESTIMONIALS_SCROLL_ABOVE
                  ? ", as a horizontal scroller"
                  : ""
              }.${
                overCap
                  ? ` You have ${onCount} switched on — only the first ${TESTIMONIALS_DISPLAY_LIMIT} appear.`
                  : ""
              }`}
        </BodySm>
      </div>

      <TestimonialList
        submitted={submitted}
        pending={pending}
        contacts={contacts}
      />
    </div>
  )
}
