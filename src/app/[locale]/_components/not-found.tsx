import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Button } from "@/components/ui/button"
import { routes } from "@/config/routes"

/**
 * NotFound — the branded, localized 404 body. Rendered by
 * `[locale]/not-found.tsx` inside the locale layout, so it inherits the site
 * header/footer and the active locale's translations. Mirrors the editorial
 * composition of the confirmation page (PageHeader + a recovery-action row)
 * and offers the three routes a lost visitor most likely wants: home, the
 * menu, and booking.
 */
export async function NotFound() {
  const t = await getTranslations("notFound")

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("intro")}
        />

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button nativeButton={false} render={<Link href={routes.home} />}>
            {t("backHome")}
          </Button>
          <ArrowLink href={routes.services}>{t("browseMenu")}</ArrowLink>
          <ArrowLink href={routes.book}>{t("book")}</ArrowLink>
        </div>
      </Container>
    </Section>
  )
}
