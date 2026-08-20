import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { MyBookings } from "@/components/sections/my-bookings"
import { ConsentCentre } from "@/components/sections/consent-centre"
import { ClientGallery } from "@/components/sections/client-gallery"
import {
  BookingsTabs,
  type BookingsTabKey,
} from "@/components/sections/bookings-tabs"
import { Container, Section } from "@/components/layout/container"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { routing } from "@/i18n/routing"
import { pendingRequestCount } from "@/lib/consent-requests"
import {
  getClientDataConsents,
  getClientMedia,
  type ClientMediaItem,
  type DataConsentItem,
} from "@/lib/media"
import { getCurrentUser } from "@/lib/identity/server"
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
    signed-out visit redirects to the localized sign-in and returns here.
    Tabbed: Bookings · Gallery · Requests (deep-linkable via `?tab=`). */
export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/appointments">) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "bookings" })

  // Own-reads via RLS; degrade to empty if the media/consent tables aren't
  // migrated yet. One fetch of media, shared across the Bookings + Gallery tabs.
  const user = await getCurrentUser()
  let media: ClientMediaItem[] = []
  let dataConsents: DataConsentItem[] = []
  let requestCount = 0
  if (user) {
    const supabase = await createAuthedSupabaseServerClient()
    ;[media, dataConsents, requestCount] = await Promise.all([
      getClientMedia(supabase, user.id).catch(() => []),
      getClientDataConsents(supabase, user.id).catch(() => []),
      pendingRequestCount(supabase, user.id).catch(() => 0),
    ])
  }

  const tabParam = singleParam(query.tab)
  const defaultTab: BookingsTabKey =
    tabParam === "gallery" || tabParam === "requests" ? tabParam : "bookings"

  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          <PageHeader
            eyebrow={t("eyebrow")}
            lead={t("headingLine1")}
            muted={t("headingLine2")}
            intro={t("intro")}
          />
          <BookingsTabs
            defaultTab={defaultTab}
            galleryCount={media.length}
            requestCount={requestCount}
            bookings={
              <MyBookings
                notice={singleParam(query.notice) ?? null}
                media={media}
              />
            }
            gallery={<ClientGallery media={media} />}
            requests={
              media.length || dataConsents.length ? (
                <ConsentCentre media={media} dataConsents={dataConsents} />
              ) : (
                <EmptyState
                  title={t("requestsEmptyTitle")}
                  body={t("requestsEmptyBody")}
                />
              )
            }
          />
        </Container>
      </Section>
    </main>
  )
}
