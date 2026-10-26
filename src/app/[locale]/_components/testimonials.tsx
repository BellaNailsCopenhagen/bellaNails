import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { SectionHeading } from "@/components/ui/section-heading"
import { TestimonialQuote } from "@/components/testimonials/testimonial-quote"
import { getPublishedTestimonials } from "@/modules/testimonials"
import {
  shouldScrollTestimonials,
  shouldShowTestimonials,
} from "@/shared/testimonial"

/**
 * Testimonials — client-written, and published only because the studio switched
 * them on (`/admin/testimonials`). Below two the section doesn't appear at all
 * (one quote reads as thin); above three it becomes a horizontal scroller —
 * never vertical, on any width.
 */
export async function Testimonials() {
  const [t, items] = await Promise.all([
    getTranslations("testimonials"),
    getPublishedTestimonials(),
  ])

  if (!shouldShowTestimonials(items.length)) {
    return null
  }

  const shape = shouldScrollTestimonials(items.length)
    ? {
        list: "-mx-6 flex snap-x snap-mandatory gap-8 overflow-x-auto overscroll-x-contain px-6 pb-2 [scrollbar-width:none] sm:gap-10 [&::-webkit-scrollbar]:hidden",
        item: "w-[78vw] max-w-xs shrink-0 snap-start sm:w-64",
      }
    : {
        list: `grid gap-10 md:gap-0 md:divide-x md:divide-border ${
          items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
        }`,
        item: "md:px-8 md:first:pl-0 md:last:pr-0",
      }

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />

        {/* `overscroll-x-contain` stops a swipe past the end from scrolling the
            page; the column count follows the item count so two quotes never
            sit beside an empty third column. */}
        <ul className={shape.list} aria-label={t("eyebrow")}>
          {items.map((item) => (
            <li key={item.id} className={shape.item}>
              <TestimonialQuote item={item} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
