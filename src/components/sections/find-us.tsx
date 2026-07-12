import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Container, Section } from "@/components/layout/container";
import { HoverArrow } from "@/components/ui/arrow-link";
import { SectionHeading } from "@/components/ui/section-heading";

import {
  STUDIO_ADDRESS_LINE_1,
  STUDIO_ADDRESS_LINE_2,
  STUDIO_MAPS_URL,
} from "@/config/studio";

/**
 * FindUs — "Find Us". Address + opening hours and a static location preview
 * image that links out to Google Maps. A real embedded map can be wired in
 * later if needed, but the static image keeps the section lightweight for now.
 */
export async function FindUs() {
  const t = await getTranslations("findUs");

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />

        <div className="flex flex-wrap items-start justify-between gap-6">
          <address className="max-w-sm font-editorial text-2xl not-italic leading-snug text-foreground">
            {STUDIO_ADDRESS_LINE_1}
            <br />
            {STUDIO_ADDRESS_LINE_2}
          </address>
          <div className="font-functional text-sm text-muted-foreground">
            <div>{t("hoursLine")}</div>
            <div>{t("hoursNote")}</div>
          </div>
        </div>

        <div className="relative">
          <a
            href={STUDIO_MAPS_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t("openMaps")}
            className="group relative z-0 flex aspect-[5/2] w-full items-center justify-center overflow-hidden bg-muted"
          >
            <Image
              src="/assets/Map_bella_nails.png"
              alt="Map preview showing the Bella Nails location in Copenhagen."
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,18,0.06)_0%,rgba(18,18,18,0.18)_100%)]"
            />
            <span className="relative z-10 inline-flex items-center gap-2 rounded-sm border border-background/65 bg-background/12 px-4 py-2 font-functional text-xs uppercase tracking-widest-lux text-background backdrop-blur-[4px]">
              {t("openMaps")}
              <HoverArrow />
            </span>
          </a>
        </div>
      </Container>
    </Section>
  );
}
