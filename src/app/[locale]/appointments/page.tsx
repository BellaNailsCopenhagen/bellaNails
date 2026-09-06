import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { AccountSettings } from "@/app/[locale]/appointments/_components/account-settings"
import { ClientGallery } from "@/app/[locale]/appointments/_components/client-gallery"
import { DesignRequestList } from "@/app/[locale]/appointments/_components/design-request-list"
import { MyBookings } from "@/app/[locale]/appointments/_components/my-bookings"
import {
  MySpaceTabs,
  type MySpaceTabKey,
} from "@/app/[locale]/appointments/_components/my-space-tabs"
import { PermissionsPanel } from "@/app/[locale]/appointments/_components/permissions-panel"
import { SignOutControl } from "@/app/[locale]/appointments/_components/sign-out-control"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { routing } from "@/i18n/routing"
import { getCurrentUser } from "@/modules/identity/server"
import { getMySpace, EMPTY_MY_SPACE, type MySpace } from "@/modules/clients"
import { getMyDesignRequests, type DesignRequestView } from "@/modules/design"
import {
  getMyTestimonialSpace,
  type MyTestimonial,
  type MyTestimonialInvite,
} from "@/modules/testimonials"
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

const TAB_KEYS = [
  "bookings",
  "ask",
  "permissions",
  "gallery",
  "settings",
] as const

/** `?tab=` → a tab. `requests` was the one tab that is now two; it lands on
    Permissions, which is where the banners that used it were pointing. */
function tabFromParam(value: string | null): MySpaceTabKey {
  if (value === "requests") return "permissions"
  return (TAB_KEYS as readonly string[]).includes(value ?? "")
    ? (value as MySpaceTabKey)
    : "bookings"
}

/** My Space — auth-gated by the proxy (`/appointments`): a signed-out visit
    redirects to the localized login and returns here. Tabbed: Appointments ·
    Ask · Permissions · Gallery · Settings (the gear), all deep-linkable via
    `?tab=`. */
export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/appointments">) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "bookings" })

  // Own-reads via RLS; degrade to empty if the media/consent tables aren't
  // migrated yet. One fetch of media, shared across Appointments, Permissions
  // and Gallery.
  const user = await getCurrentUser()
  let space: MySpace = EMPTY_MY_SPACE
  let designRequests: DesignRequestView[] = []
  let offerTokens: Record<string, string> = {}
  let testimonialInvite: MyTestimonialInvite | null = null
  let myTestimonials: MyTestimonial[] = []
  if (user) {
    const [mySpace, design, testimonials] = await Promise.all([
      getMySpace(user.id),
      getMyDesignRequests(),
      getMyTestimonialSpace(),
    ])
    space = mySpace
    designRequests = design.requests
    offerTokens = design.offerTokens
    testimonialInvite = testimonials.invite
    myTestimonials = testimonials.items
  }

  // A live offer or an unread answer both want the client in here; a thread
  // with both is still one thing to look at, so count threads, not signals.
  const unreadReplies = designRequests.filter((r) => r.hasUnreadReply).length
  const askCount = designRequests.filter(
    (r) => r.offer?.state === "live" || r.hasUnreadReply,
  ).length

  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          {/* Above the header, opposite the eyebrow: leaving is not a setting,
              and it was unfindable three levels down inside one. */}
          <div className="flex justify-end pb-4">
            <SignOutControl />
          </div>
          <PageHeader
            eyebrow={t("eyebrow")}
            lead={t("headingLine1")}
            muted={t("headingLine2")}
            intro={t("intro")}
          />
          <MySpaceTabs
            defaultTab={tabFromParam(singleParam(query.tab) ?? null)}
            galleryCount={space.media.length}
            askCount={askCount}
            permissionCount={
              space.requestCount + (testimonialInvite ? 1 : 0)
            }
            unreadReplies={unreadReplies}
            bookings={
              <MyBookings
                notice={singleParam(query.notice) ?? null}
                media={space.media}
              />
            }
            ask={
              <DesignRequestList
                requests={designRequests}
                offerTokens={offerTokens}
              />
            }
            permissions={
              <PermissionsPanel
                permissions={space.permissions}
                permissionsError={space.permissionsError}
                media={space.media}
                dataConsents={space.dataConsents}
                testimonialInviteToken={testimonialInvite?.token ?? null}
                testimonials={myTestimonials}
              />
            }
            gallery={<ClientGallery media={space.media} />}
            settings={
              <AccountSettings
                email={space.profile?.email ?? null}
                name={space.profile?.name ?? null}
                phone={space.profile?.phone ?? null}
              />
            }
          />
        </Container>
      </Section>
    </main>
  )
}
