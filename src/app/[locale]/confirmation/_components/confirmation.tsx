import { SignedIn, SignedOut } from "@/components/auth/auth-gate"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { ConfirmationRecap } from "@/app/[locale]/confirmation/_components/confirmation-recap"
import { ConfirmationRelease } from "@/app/[locale]/confirmation/_components/confirmation-release"
import { signBookingToken } from "@/modules/booking/manage-token"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { BodySm, Eyebrow, H3 } from "@/components/ui/typography"
import { routes } from "@/config/routes"
import { getBusinessProfile } from "@/modules/business/profile"
import { oneLineAddress } from "@/shared/business-profile"

/**
 * No `?id` — a stale bookmark, a back-button return, a link passed on. Nothing
 * was reserved, so nothing here may imply it was. Calm, same furniture, and the
 * two ways on: the menu, and My Space for an appointment they already have.
 */
async function BookingNotFound() {
  const t = await getTranslations("confirmation")
  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("missingEyebrow")}
          lead={t("missingHeadingLine1")}
          muted={t("missingHeadingLine2")}
          intro={t("missingIntro")}
        />
        <div className="flex flex-wrap gap-4">
          <Button nativeButton={false} render={<Link href={routes.services} />}>
            {t("missingBrowseServices")}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.appointments} />}
          >
            {t("viewBookings")}
          </Button>
        </div>
      </Container>
    </Section>
  )
}

/**
 * Confirmation — the branded post-booking success page. The recap is fetched by
 * booking id, and signed-in visitors get the "view my bookings" CTA. Without an
 * id there is nothing to confirm, so the page says so rather than reassuring
 * someone about a booking that was never made.
 *
 * The signed-OUT branch is no longer reachable from a fresh booking (booking
 * requires a session), only from an old link or a lapsed one — so it offers a
 * plain sign-in rather than an account pitch prefilled with an email we would
 * have had to carry through the URL to get here.
 */
export async function Confirmation({ id }: { id: string | null }) {
  if (!id) return <BookingNotFound />

  const [t, profile] = await Promise.all([
    getTranslations("confirmation"),
    getBusinessProfile(),
  ])
  const address = oneLineAddress(profile)
  // Sign a token so the (possibly guest) client can pre-approve the media release
  // for this booking. Guarded — a missing token secret just hides the opt-in.
  let releaseToken: string | null = null
  try {
    releaseToken = signBookingToken(id)
  } catch {
    releaseToken = null
  }

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("intro")}
        />

        {/* Recap first in the DOM: on mobile/tablet the booking details are
            the payoff and lead the page (what/when → where → account pitch →
            exit links). Two columns only from lg — below that the fixed-width
            account card and the summary can't share a row without overlapping.
            `lg:flex-row-reverse` keeps desktop as recap right, content left. */}
        <div className="flex flex-col gap-12 lg:flex-row-reverse lg:items-start lg:justify-between lg:gap-16">
          <ConfirmationRecap id={id} />

          <div className="w-full min-w-0 flex-1 space-y-10">
            <div className="space-y-2">
              <Eyebrow className="font-normal">{t("whereLabel")}</Eyebrow>
              {address ? (
                <BodySm className="text-foreground">{address}</BodySm>
              ) : null}
              <BodySm>{t("arrivalNote")}</BodySm>
            </div>

            <SignedOut>
              <div className="space-y-6 border-t border-border pt-10">
                <div className="space-y-2">
                  <H3>{t("accountTitle")}</H3>
                  <BodySm className="max-w-md">{t("accountBody")}</BodySm>
                </div>
                <Button
                  nativeButton={false}
                  render={
                    <Link href={routes.signIn} />
                  }
                >
                  {t("accountTitle")}
                </Button>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="border-t border-border pt-10">
                {releaseToken ? (
                  // Media-release opt-in leads; it hands back to the manage-booking
                  // note once saved or skipped.
                  <ConfirmationRelease
                    token={releaseToken}
                    signedInBody={t("signedInBody")}
                    viewBookingsLabel={t("viewBookings")}
                    appointmentsHref={routes.appointments}
                  />
                ) : (
                  <div className="space-y-4">
                    <BodySm className="max-w-md">{t("signedInBody")}</BodySm>
                    <Button
                      nativeButton={false}
                      render={<Link href={routes.appointments} />}
                    >
                      {t("viewBookings")}
                    </Button>
                  </div>
                )}
              </div>
            </SignedIn>
          </div>
        </div>
      </Container>
    </Section>
  )
}
