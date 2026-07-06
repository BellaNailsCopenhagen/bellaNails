import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Display,
  Eyebrow,
  HeadingAccent,
  HeadingLine,
} from "@/components/ui/typography";
import { routes } from "@/config/routes";

/**
 * Hero — full-bleed landing statement. Fills the viewport below the 4rem
 * header. Uses a temporary local hero photo until the final brand imagery
 * (and later video options) are ready.
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden">
      <Image
        src="/assets/hero_image.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-10 object-cover object-center"
      />
      {/* Comp overlay: diagonal darkening for text contrast. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(70deg,rgba(0,0,0,0.76)_10%,rgba(0,0,0,0.26)_95%)]"
      />

      <div className="flex max-w-3xl flex-col items-center gap-10 px-6 text-center">
        <Eyebrow className="text-background/70">{t("kicker")}</Eyebrow>
        <Display className="text-background">
          <HeadingLine>{t("headlineLead")}</HeadingLine>
          <HeadingAccent className="text-background">
            {t("headlineAccent")}
          </HeadingAccent>
        </Display>
        <Button
          variant="inverse"
          size="lg"
          nativeButton={false}
          render={<Link href={routes.book} />}
        >
          {t("reserveCta")}
        </Button>
      </div>

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span aria-hidden className="h-12 w-px bg-background/45" />
        <Eyebrow as="span" className="text-background/45">
          {t("scroll")}
        </Eyebrow>
      </div>
    </section>
  );
}
