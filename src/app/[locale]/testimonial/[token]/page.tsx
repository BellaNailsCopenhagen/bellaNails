import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { TestimonialForm } from "@/app/[locale]/testimonial/[token]/_components/testimonial-form"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { getTestimonialInviteByToken } from "@/modules/testimonials"
import { routes } from "@/config/routes"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "testimonialForm" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // A personal invitation — never indexed.
    robots: { index: false, follow: false },
  }
}

/**
 * "Say a few words" — the client's own invitation, reached by a signed link. The
 * token names the row; the ROW's status is the gate, so a used or withdrawn
 * invitation explains itself instead of showing a second form.
 *
 * Three fields, by decision: name, occupation (optional), a short text. Nothing
 * else belongs in this flow.
 */
export default async function TestimonialPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: "testimonialForm" })

  const invite = await getTestimonialInviteByToken(token)

  if (!invite) {
    return (
      <Shell lead={t("invalidTitle")} eyebrow={t("eyebrow")}>
        <BodySm>{t("invalidBody")}</BodySm>
        <HomeButton label={t("backHome")} />
      </Shell>
    )
  }

  if (invite.status !== "requested") {
    // "Used" is only true if they actually wrote something; a studio-withdrawn
    // invitation must not thank them for words they never sent.
    const closed = invite.status === "declined" && !invite.answered
    return (
      <Shell
        lead={t(closed ? "closedTitle" : "usedTitle")}
        eyebrow={t("eyebrow")}
      >
        <BodySm>{t(closed ? "closedBody" : "usedBody")}</BodySm>
        <HomeButton label={t("backHome")} />
      </Shell>
    )
  }

  return (
    <Section>
      <Container className="max-w-4xl space-y-10">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          muted={t("headingAccent")}
          intro={t("intro")}
        />
        <TestimonialForm token={token} />
      </Container>
    </Section>
  )
}

function Shell({
  eyebrow,
  lead,
  children,
}: {
  eyebrow: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <Section>
      <Container className="max-w-4xl space-y-6">
        <PageHeader eyebrow={eyebrow} lead={lead} />
        {children}
      </Container>
    </Section>
  )
}

function HomeButton({ label }: { label: string }) {
  return (
    <div>
      <Button nativeButton={false} render={<Link href={routes.home} />}>
        {label}
      </Button>
    </div>
  )
}
