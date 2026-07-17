import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { StudioGallery } from "@/components/sections/studio-gallery"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { routes } from "@/config/routes"

/** GalleryPreview — the placeholder /gallery page: editorial header, the
    existing DB-backed studio imagery, and a note that the full portfolio is
    on its way. Replaced by the curated gallery when the photos land. */
export async function GalleryPreview() {
  const t = await getTranslations("gallery")

  return (
    <>
      <Section className="pb-0">
        <Container className="max-w-4xl">
          <PageHeader
            eyebrow={t("eyebrow")}
            lead={t("headingLead")}
            muted={t("headingMuted")}
            intro={t("intro")}
          />
        </Container>
      </Section>
      <StudioGallery />
      <Section className="pt-0">
        <Container className="max-w-4xl">
          <div className="space-y-6">
            <BodySm className="max-w-md">{t("comingSoon")}</BodySm>
            <Button nativeButton={false} render={<Link href={routes.book} />}>
              {t("bookCta")}
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
