import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

/**
 * Hero — full-bleed landing statement. Fills the viewport below the 4rem
 * header. The backdrop is a placeholder onyx gradient with the comp's diagonal
 * darkening overlay so the headline stays legible; the real atelier photo is
 * wired via Cloudinary in Phase 7/8.
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden">
      {/* Placeholder backdrop (replace with Cloudinary image). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-[#1a1a19] via-[#2b2825] to-[#413c37]"
      />
      {/* Comp overlay: diagonal darkening for text contrast. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(70deg,rgba(0,0,0,0.76)_10%,rgba(0,0,0,0.26)_95%)]"
      />

      <div className="flex max-w-3xl flex-col items-center gap-10 px-6 text-center">
        <Display className="text-balance text-background">{t("headline")}</Display>
        <Button
          variant="inverse"
          size="lg"
          nativeButton={false}
          render={<Link href="/book" />}
        >
          {t("reserveCta")}
        </Button>
      </div>

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span aria-hidden className="h-12 w-px bg-background/45" />
        <span className="font-functional text-[11px] uppercase tracking-widest-lux text-background/45">
          {t("scroll")}
        </span>
      </div>
    </section>
  );
}
