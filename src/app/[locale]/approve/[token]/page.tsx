import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { Container, Section } from "@/components/layout/container"
import { ApproveRelease } from "@/app/[locale]/approve/[token]/_components/approve-release"
import { getReleaseRequestForToken } from "@/modules/media"
import { pickReleaseCopy } from "@/shared/media-release"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  // A tokenized personal link — never in a search index.
  return {
    title: pickReleaseCopy(locale).heading,
    robots: { index: false, follow: false },
  }
}

export const dynamic = "force-dynamic"

/**
 * Guest media-release approval (no account). The signed token from the email IS
 * the authorization — verified in the read and again in the action. Read with
 * service-role; a bad/expired token or an already-answered request degrades to a
 * message rather than 404, so the guest always sees something sensible.
 */
export default async function ApprovePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const card = await getReleaseRequestForToken(token)

  return (
    <Section>
      <Container className="max-w-4xl">
        <ApproveRelease token={token} card={card} />
      </Container>
    </Section>
  )
}
