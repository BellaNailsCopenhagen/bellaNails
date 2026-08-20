import { SignedIn, SignedOut } from "@/components/auth/auth-gate"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { ConfirmationRecap } from "@/components/sections/confirmation-recap"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Button } from "@/components/ui/button"
import { BodySm, Eyebrow, H3 } from "@/components/ui/typography"
import { routes } from "@/config/routes"
import { STUDIO_ADDRESS } from "@/config/studio"

/**
 * Confirmation — the branded post-booking success page. The recap arrives via
 * a short client-side poll (the webhook that writes the row races this page),
 * and the hero secondary action is completing the account: passwordless
 * email-code / Google / Apple via the prebuilt <SignUp/>, prefilled with the
 * booking email. Signed-in visitors (including "just activated here" — Show
 * is reactive) get the "view my bookings" CTA instead. A direct hit without a
 * uid renders a calm generic confirmed state — never an error.
 */
export async function Confirmation({ uid }: { uid: string | null }) {
  const t = await getTranslations("confirmation")

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
            Clerk card and the summary can't share a row without overlapping.
            `lg:flex-row-reverse` keeps desktop as recap right, content left. */}
        <div className="flex flex-col gap-12 lg:flex-row-reverse lg:items-start lg:justify-between lg:gap-16">
          {uid ? <ConfirmationRecap uid={uid} /> : null}

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
              <div className="space-y-4 border-t border-border pt-10">
                <BodySm className="max-w-md">{t("signedInBody")}</BodySm>
                <Button
                  nativeButton={false}
                  render={<Link href={routes.appointments} />}
                >
                  {t("viewBookings")}
                </Button>
              </div>
            </SignedIn>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <ArrowLink href={routes.home}>{t("backHome")}</ArrowLink>
              <ArrowLink href={routes.services}>{t("browseMenu")}</ArrowLink>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
