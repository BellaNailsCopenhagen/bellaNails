import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { HeroVideo } from "@/app/[locale]/_components/hero-video"
import { getBusinessProfile } from "@/modules/business/profile"
import { Button } from "@/components/ui/button"
import {
  Display,
  Eyebrow,
  HeadingAccent,
  HeadingLine,
} from "@/components/ui/typography"
import { routes } from "@/config/routes"

/**
 * Hero — full-bleed landing statement. Fills the viewport below the 4rem
 * header.
 *
 * What sits behind it is hers to change: a photo or a film uploaded on the
 * Business page. The kind is read from the stored key, so one upload decides
 * which of the two renders. Nothing uploaded — or storage not configured — and
 * it is the photo shipped with the app, because the first screen of the site
 * cannot be allowed to be empty.
 */
export async function Hero() {
  const [t, { heroBackground }] = await Promise.all([
    getTranslations("hero"),
    getBusinessProfile(),
  ])

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden">
      {heroBackground.kind === "video" ? (
        <HeroVideo src={heroBackground.url} />
      ) : (
        <Image
          src={heroBackground.url}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-10 object-cover object-center"
        />
      )}
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
  )
}
