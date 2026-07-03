import { getTranslations } from "next-intl/server";

import { Container, Section } from "@/components/layout/container";
import {
  Body,
  Caption,
  Eyebrow,
  H1,
  HeadingAccent,
  HeadingLine,
} from "@/components/ui/typography";

/**
 * Formula — "Made to last, even on the most difficult nails." The maker's-note
 * section: editorial heading, a paragraph, and the product credentials as
 * inline meta labels plus two bordered chips.
 */
export async function Formula() {
  const t = await getTranslations("formula");

  const inlineBadges = [t("hemaFree"), t("vegan"), t("crueltyFree")];
  const chips = [t("fiberglass"), t("vitamins")];

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-8">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <H1 as="h2">
          <HeadingLine>{t("headingLead")}</HeadingLine>
          <HeadingAccent className="text-muted-foreground">
            {t("headingAccent")}
          </HeadingAccent>
        </H1>
        <Body className="max-w-3xl text-muted-foreground">{t("body")}</Body>

        <div className="space-y-5 pt-2">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {inlineBadges.map((label) => (
              <Caption key={label} className="tracking-widest-lux text-muted-foreground">
                {label}
              </Caption>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {chips.map((label) => (
              <span
                key={label}
                className="border border-border px-4 py-2.5 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
