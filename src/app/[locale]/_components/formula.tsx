import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "@/components/ui/section-heading"
import { Body } from "@/components/ui/typography"

/**
 * Formula — "Made to last, even on the most difficult nails." The maker's-note
 * section: editorial heading, a paragraph, and the product credentials as
 * inline meta labels plus two bordered chips.
 */
export async function Formula() {
  const t = await getTranslations("formula")

  const inlineBadges = [t("hemaFree"), t("vegan"), t("crueltyFree")]
  const chips = [t("fiberglass"), t("vitamins")]

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />
        <Body className="max-w-3xl text-muted-foreground">{t("body")}</Body>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {inlineBadges.map((label) => (
              <Badge key={label} size="sm">
                {label}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {chips.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
