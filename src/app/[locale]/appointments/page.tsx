import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { MyBookings } from "@/app/[locale]/appointments/_components/my-bookings"
import { ConsentCentre } from "@/app/[locale]/appointments/_components/consent-centre"
import { ClientGallery } from "@/app/[locale]/appointments/_components/client-gallery"
import {
  BookingsTabs,
  type BookingsTabKey,
} from "@/app/[locale]/appointments/_components/bookings-tabs"
import { AccountSettings } from "@/app/[locale]/appointments/_components/account-settings"
import { Container, Section } from "@/components/layout/container"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { routing } from "@/i18n/routing"
import type {
  ClientMediaItem,
  DataConsentItem,
} from "@/modules/media/client-gallery"
import { getCurrentUser } from "@/modules/identity/server"
import { getMySpace } from "@/modules/clients"
import { singleParam } from "@/shared/search-params"

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

/** My Space — auth-gated by the proxy (`/appointments`): a signed-out visit
    redirects to the localized login and returns here. Tabbed: Appointments ·
    Gallery · Requests · Settings (the gear), all deep-linkable via `?tab=`. */
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
  let profile: {
    name: string | null
    phone: string | null
    email: string | null
  } | null = null
  if (user) {
    const space = await getMySpace(user.id)
    media = space.media
    dataConsents = space.dataConsents
    requestCount = space.requestCount
    profile = space.profile
  }

  const tabParam = singleParam(query.tab)
  const defaultTab: BookingsTabKey =
    tabParam === "gallery" ||
    tabParam === "requests" ||
    tabParam === "settings"
      ? tabParam
      : "bookings"

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
            settings={
              <AccountSettings
                email={profile?.email ?? null}
                name={profile?.name ?? null}
                phone={profile?.phone ?? null}
              />
            }
          />
        </Container>
      </Section>
    </main>
  )
}
