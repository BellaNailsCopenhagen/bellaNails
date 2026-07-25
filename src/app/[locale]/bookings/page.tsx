import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { MyBookings } from "@/components/sections/my-bookings"
import { ConsentCentre } from "@/components/sections/consent-centre"
import { Container, Section } from "@/components/layout/container"
import { routing } from "@/i18n/routing"
import {
  getClientDataConsents,
  getClientMedia,
  type ClientMediaItem,
  type DataConsentItem,
} from "@/lib/media"
import { singleParam } from "@/lib/search-params"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "bookings" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Personal account page — never in a search index.
    robots: { index: false, follow: false },
  }
}

/** Auth gate lives in the proxy (`/bookings` is a protected route): a
    signed-out visit redirects to the localized sign-in and returns here. */
export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/bookings">) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // The client's consent requests. Own-read via RLS; degrades to empty if the
  // media/consent tables aren't migrated yet.
  const { userId } = await auth()
  let media: ClientMediaItem[] = []
  let dataConsents: DataConsentItem[] = []
  if (userId) {
    const supabase = createAuthedSupabaseServerClient()
    ;[media, dataConsents] = await Promise.all([
      getClientMedia(supabase, userId).catch(() => []),
      getClientDataConsents(supabase, userId).catch(() => []),
    ])
  }

  return (
    <main className="flex flex-1 flex-col">
      <MyBookings notice={singleParam(query.notice) ?? null} media={media} />
      {media.length || dataConsents.length ? (
        <Section>
          <Container className="max-w-4xl">
            <ConsentCentre media={media} dataConsents={dataConsents} />
          </Container>
        </Section>
      ) : null}
    </main>
  )
}
