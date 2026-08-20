import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { SectionHeading } from "@/components/ui/section-heading"

/**
 * Testimonials — "Client Words". Three editorial pull-quotes with attributions,
 * divided by vertical hairlines on desktop (stacked on mobile).
 */
export async function Testimonials() {
  const t = await getTranslations("testimonials")

  const items = [
    { quote: t("one.quote"), name: t("one.name"), role: t("one.role") },
    { quote: t("two.quote"), name: t("two.name"), role: t("two.role") },
    { quote: t("three.quote"), name: t("three.name"), role: t("three.role") },
  ].filter((item) => item.quote.trim() && item.name.trim() && item.role.trim())

  if (!items.length) return null

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />
        <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
          {items.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col justify-between gap-8 md:px-8 md:first:pl-0 md:last:pr-0"
            >
              <blockquote className="font-editorial text-2xl leading-snug text-foreground text-pretty">
                {item.quote}
              </blockquote>
              <figcaption className="space-y-1">
                <div className="font-functional text-xs text-foreground">
                  {item.name}
                </div>
                <div className="font-functional text-[11px] uppercase tracking-widest-lux text-muted-foreground">
                  {item.role}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  )
}
