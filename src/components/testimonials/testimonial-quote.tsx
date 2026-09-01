import type { PublishedTestimonial } from "@/shared/testimonial"

/**
 * One testimonial, rendered. Shared by the public home section and the client's
 * own view in My Space — so "this is exactly how it appears on the site" is
 * literally true rather than a claim two components have to keep in step.
 */
export function TestimonialQuote({ item }: { item: PublishedTestimonial }) {
  return (
    <figure className="flex h-full flex-col justify-between gap-8">
      <blockquote className="font-editorial text-2xl leading-snug text-foreground text-pretty">
        {item.body}
      </blockquote>
      <figcaption className="space-y-1">
        <div className="font-functional text-xs text-foreground">
          {item.authorName}
        </div>
        {item.occupation ? (
          <div className="font-functional text-[11px] uppercase tracking-widest-lux text-muted-foreground">
            {item.occupation}
          </div>
        ) : null}
      </figcaption>
    </figure>
  )
}
