import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import {
  BodySm,
  Caption,
  Eyebrow,
  H1,
  H3,
  HeadingAccent,
  HeadingLine,
} from "@/components/ui/typography";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ServicesPreview — "A Selection of the Studio's Best". Reads the featured
 * services from Supabase (public anon read via RLS), localized by the active
 * locale, prices via PriceTag. Renders nothing if there are no featured rows.
 */
export async function ServicesPreview() {
  const [t, tNav, locale] = await Promise.all([
    getTranslations("services"),
    getTranslations("nav"),
    getLocale(),
  ]);

  const supabase = createSupabaseServerClient();
  const { data: services } = await supabase
    .from("services")
    .select(
      "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins",
    )
    .eq("is_featured", true)
    .is("archived_at", null)
    .order("cal_event_id", { ascending: true })
    .limit(3);

  if (!services?.length) return null;

  const isDa = locale === "da";

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-4">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <H1 as="h2">
              <HeadingLine>{t("headingLead")}</HeadingLine>
              <HeadingAccent>{t("headingAccent")}</HeadingAccent>
            </H1>
          </div>
          <Link
            href="/services"
            className="group inline-flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("viewFullMenu")}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        <ul className="mt-12 border-b border-border">
          {services.map((service, i) => {
            const name = (isDa ? service.name_dk : service.name_en) ?? service.name_en;
            const description =
              (isDa ? service.description_dk : service.description_en) ?? "";
            return (
              <li
                key={service.id}
                className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border py-6 md:grid-cols-[2.5rem_minmax(11rem,1fr)_1.4fr_auto] md:items-baseline"
              >
                <Caption className="text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </Caption>
                <div className="space-y-1">
                  <H3>{name}</H3>
                  <Caption className="tracking-wide text-muted-foreground">
                    {service.base_duration_mins} {t("minutes")}
                  </Caption>
                </div>
                <BodySm className="max-w-sm">{description}</BodySm>
                <PriceTag cents={service.base_price_cents} className="text-lg" />
              </li>
            );
          })}
        </ul>

        <Button
          className="mt-10"
          nativeButton={false}
          render={<Link href="/book" />}
        >
          {tNav("reserve")}
        </Button>
      </Container>
    </Section>
  );
}
