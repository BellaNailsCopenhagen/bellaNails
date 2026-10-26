import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { routes } from "@/config/routes"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return {
    title: locale === "en" ? "Request sent" : "Anmodning sendt",
    // Personal post-request page — never in a search index.
    robots: { index: false, follow: false },
  }
}

/**
 * Post-request confirmation — where the booking-request flow lands after a
 * client sends an outside-hours or over-limit request. Deliberately distinct
 * from /confirmation: this is NOT a confirmed booking, and the copy makes that
 * unmistakable.
 */
export default async function RequestSentPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)
  const isEn = locale === "en"

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={isEn ? "Booking request" : "Booking-anmodning"}
          lead={isEn ? "Request sent" : "Anmodning sendt"}
          muted={isEn ? "we'll be in touch" : "vi vender tilbage"}
          intro={
            isEn
              ? "We've emailed you a confirmation. This isn't a booking yet — the studio will review your request and get back to you to confirm a time."
              : "Vi har sendt dig en bekræftelse på e-mail. Dette er ikke en booking endnu — salonen ser på din anmodning og vender tilbage for at bekræfte et tidspunkt."
          }
        />
        <div className="flex flex-wrap gap-3">
          <Button
            nativeButton={false}
            render={<Link href={routes.appointments} />}
          >
            {isEn ? "View my appointments" : "Se Mit rum"}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.home} />}
          >
            {isEn ? "Back to home" : "Til forsiden"}
          </Button>
        </div>
      </Container>
    </Section>
  )
}
