import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { StudioGallery } from "@/components/sections/studio-gallery"
import { ClientWorkSection } from "@/components/sections/client-work-section"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { getPublicAssetsBySurface } from "@/lib/services/get-public-assets"
import { routes } from "@/config/routes"

const CLIENT_WORK_LIMIT = 48

/** GalleryPreview — the /gallery page: editorial header, the DB-backed studio
    imagery, then consented client work (from the `clients_gallery` surface) as
    it lands. The "portfolio on its way" note only shows while no client work
    has been placed yet, so the page never contradicts itself. */
export async function GalleryPreview() {
  const [t, clientWork] = await Promise.all([
    getTranslations("gallery"),
    getPublicAssetsBySurface("clients_gallery", CLIENT_WORK_LIMIT),
  ])
  const hasClientWork = clientWork.length > 0

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

      {hasClientWork ? (
        <ClientWorkSection
          eyebrow={t("clientWorkEyebrow")}
          lead={t("clientWorkLead")}
          accent={t("clientWorkAccent")}
          alt={t("clientWorkAlt")}
          assets={clientWork}
        />
      ) : null}

      {/* Book CTA always shows; the "portfolio on its way" note only while the
          client-work grid is empty (otherwise it would contradict it). */}
      <Section className={hasClientWork ? undefined : "pt-0"}>
        <Container className="max-w-4xl">
          <div className="space-y-6">
            {hasClientWork ? null : (
              <BodySm className="max-w-md">{t("comingSoon")}</BodySm>
            )}
            <Button nativeButton={false} render={<Link href={routes.book} />}>
              {t("bookCta")}
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
