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
import { STUDIO_ADDRESS } from "@/config/studio"

/**
 * Confirmation — the branded post-booking success page. The recap is fetched by
 * booking id, and the hero secondary action is completing the account: sign-in
 * prefilled with the booking email. Signed-in visitors (including "just
 * activated here" — Show is reactive) get the "view my bookings" CTA instead. A
 * direct hit without an id renders a calm generic confirmed state — never an
 * error.
 */
export async function Confirmation({ id }: { id: string | null }) {
  const t = await getTranslations("confirmation")
  // Sign a token so the (possibly guest) client can pre-approve the media release
  // for this booking. Guarded — a missing token secret just hides the opt-in.
  let releaseToken: string | null = null
  if (id) {
    try {
      releaseToken = signBookingToken(id)
    } catch {
      releaseToken = null
    }
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
          {id ? <ConfirmationRecap id={id} /> : null}

          <div className="w-full min-w-0 flex-1 space-y-10">
            <div className="space-y-2">
              <Eyebrow className="font-normal">{t("whereLabel")}</Eyebrow>
              <BodySm className="text-foreground">{STUDIO_ADDRESS}</BodySm>
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
                  render={<Link href={routes.signIn} />}
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
