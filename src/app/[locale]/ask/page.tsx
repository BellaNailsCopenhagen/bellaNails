import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { AskForm } from "@/app/[locale]/ask/_components/ask-form"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { PageHeader } from "@/components/ui/page-header"
import { getCurrentUser } from "@/modules/identity"
import { DESIGN_TOPICS, isDesignTopic } from "@/shared/design"
import { routes } from "@/config/routes"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "ask" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // A personal enquiry form — useful to a client, not to a search index.
    robots: { index: false, follow: true },
  }
}

/**
 * "Ask Bella" — the async way in. A client describes what they want (with up to
 * three reference photos) and the artist answers with a one-time offer. Sign-in
 * is required: the studio has to be able to reply, and they have to be able to come
 * back for the offer.
 *
 * `?topic=` + `?booking=` prefill the repair path from a past appointment.
 */
export default async function AskPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ topic?: string; booking?: string; service?: string }>
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const [t, user] = await Promise.all([
    getTranslations({ locale, namespace: "ask" }),
    getCurrentUser(),
  ])

  const topic =
    query.topic && isDesignTopic(query.topic) ? query.topic : DESIGN_TOPICS[0]

  return (
    <Section>
      <Container className="max-w-4xl space-y-10">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          muted={t("headingAccent")}
          intro={t("intro")}
        />

        {user ? (
          <AskForm
            defaultTopic={topic}
            bookingId={query.booking}
            serviceId={query.service}
          />
        ) : (
          <div className="space-y-4 border-t border-border pt-8">
            <BodySm>{t("signInPrompt")}</BodySm>
            <Button nativeButton={false} render={<Link href={routes.signIn} />}>
              {t("signInCta")}
            </Button>
          </div>
        )}
      </Container>
    </Section>
  )
}
