import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { SectionHeading } from "@/components/ui/section-heading"
import { BodySm, Caption, H3 } from "@/components/ui/typography"

/**
 * Differentiators — the three studio promises (Private Sessions / Premium
 * Formulas / The Atelier Edit) as a numbered three-column grid.
 */
export async function Differentiators() {
  const t = await getTranslations("differentiators")

  const items = [
    { n: "01", title: t("one.title"), body: t("one.body") },
    { n: "02", title: t("two.title"), body: t("two.body") },
    { n: "03", title: t("three.title"), body: t("three.body") },
  ]

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.n} className="space-y-3">
              <Caption className="text-muted-foreground">{item.n}</Caption>
              <H3>{item.title}</H3>
              <BodySm className="max-w-xs">{item.body}</BodySm>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
