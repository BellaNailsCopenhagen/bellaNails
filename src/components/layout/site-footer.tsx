import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Eyebrow, Body } from "@/components/ui/typography";

/**
 * SiteFooter — closing band: wordmark + tagline, contact, and fine print.
 * `year` is passed via prop so the (RSC) footer stays render-deterministic.
 */
export async function SiteFooter({ year }: { year: number }) {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-auto border-t border-border/60 bg-card">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-sm space-y-3">
          <Link
            href="/"
            className="font-editorial text-2xl tracking-tightest text-foreground"
          >
            Bella Nails
          </Link>
          <Body className="text-sm text-muted-foreground">{t("tagline")}</Body>
        </div>

        <div className="space-y-2 font-functional text-sm text-muted-foreground">
          <a
            href="mailto:hello@bellanails.dk"
            className="block transition-colors hover:text-foreground"
          >
            hello@bellanails.dk
          </a>
          <Eyebrow className="text-[0.65rem]">
            © {year} Bella Nails · {t("rights")}
          </Eyebrow>
        </div>
      </Container>
    </footer>
  );
}
