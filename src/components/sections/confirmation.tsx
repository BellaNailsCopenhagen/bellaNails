import { Show, SignUp } from "@clerk/nextjs";
import { getLocale, getTranslations } from "next-intl/server";

import { getPathname, Link } from "@/i18n/navigation";
import { ConfirmationRecap } from "@/components/sections/confirmation-recap";
import { Container, Section } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button } from "@/components/ui/button";
import { BodySm, Eyebrow, H3 } from "@/components/ui/typography";
import { routes } from "@/config/routes";
import { STUDIO_ADDRESS } from "@/config/studio";

/**
 * Confirmation — the branded post-booking success page. The recap arrives via
 * a short client-side poll (the webhook that writes the row races this page),
 * and the hero secondary action is completing the account: passwordless
 * email-code / Google / Apple via the prebuilt <SignUp/>, prefilled with the
 * booking email. Signed-in visitors (including "just activated here" — Show
 * is reactive) get the "view my bookings" CTA instead. A direct hit without a
 * uid renders a calm generic confirmed state — never an error.
 */
export async function Confirmation({
  uid,
  email,
}: {
  uid: string | null;
  email: string | null;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("confirmation"),
    getLocale(),
  ]);

  // Land back on this exact page after the account is verified, so the
  // signed-in state swaps in with the recap still on screen.
  const basePath = getPathname({ locale, href: routes.confirmation });
  const returnUrl = uid
    ? `${basePath}?${new URLSearchParams({ uid })}`
    : basePath;

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("intro")}
        />

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="w-full min-w-0 flex-1 space-y-10">
            <div className="space-y-2">
              <Eyebrow className="font-normal">{t("whereLabel")}</Eyebrow>
              <BodySm className="text-foreground">{STUDIO_ADDRESS}</BodySm>
              <BodySm>{t("arrivalNote")}</BodySm>
            </div>

            <Show when="signed-out">
              <div className="space-y-6 border-t border-border pt-10">
                <div className="space-y-2">
                  <H3>{t("accountTitle")}</H3>
                  <BodySm className="max-w-md">{t("accountBody")}</BodySm>
                </div>
                <SignUp
                  routing="hash"
                  forceRedirectUrl={returnUrl}
                  initialValues={email ? { emailAddress: email } : undefined}
                />
              </div>
            </Show>

            <Show when="signed-in">
              <div className="space-y-4 border-t border-border pt-10">
                <BodySm className="max-w-md">{t("signedInBody")}</BodySm>
                <Button nativeButton={false} render={<Link href={routes.bookings} />}>
                  {t("viewBookings")}
                </Button>
              </div>
            </Show>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <ArrowLink href={routes.home}>{t("backHome")}</ArrowLink>
              <ArrowLink href={routes.services}>{t("browseMenu")}</ArrowLink>
            </div>
          </div>

          {uid ? <ConfirmationRecap uid={uid} /> : null}
        </div>
      </Container>
    </Section>
  );
}
