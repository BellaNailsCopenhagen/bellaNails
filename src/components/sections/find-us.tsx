import { getTranslations } from "next-intl/server";

import { Container, Section } from "@/components/layout/container";
import { Eyebrow } from "@/components/ui/typography";

// Studio address (literal — not translated). Also drives the Maps link.
const ADDRESS_LINE_1 = "Halldór Laxness Vej 3, 2. th";
const ADDRESS_LINE_2 = "2300 København S";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Halldór Laxness Vej 3, 2300 København S");

/**
 * FindUs — "Find Us". Address + opening hours and a map placeholder that links
 * out to Google Maps (a real embedded map is wired in a later pass). Placeholder
 * keeps it reliable and dependency-free for now.
 */
export async function FindUs() {
  const t = await getTranslations("findUs");

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-8">
        <Eyebrow>{t("eyebrow")}</Eyebrow>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <address className="max-w-sm font-editorial text-2xl not-italic leading-snug text-foreground">
            {ADDRESS_LINE_1}
            <br />
            {ADDRESS_LINE_2}
          </address>
          <div className="font-functional text-sm text-muted-foreground">
            <div>{t("hoursLine")}</div>
            <div>{t("hoursNote")}</div>
          </div>
        </div>

        <a
          href={MAPS_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t("openMaps")}
          className="group flex aspect-[5/2] w-full items-center justify-center overflow-hidden bg-muted transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_4%)]"
        >
          <span className="inline-flex items-center gap-2 rounded-sm bg-foreground/90 px-4 py-2 font-functional text-xs uppercase tracking-widest-lux text-background">
            {t("openMaps")}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </a>
      </Container>
    </Section>
  );
}
