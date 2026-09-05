import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { ArrowLink, HoverArrow } from "@/components/ui/arrow-link"
import { SectionHeading } from "@/components/ui/section-heading"

import { getBusinessProfile } from "@/modules/business/profile"
import { mapsUrlFor, oneLineAddress } from "@/shared/business-profile"
import { routes } from "@/config/routes"

/**
 * FindUs — "Find Us". Address, the studio's real opening hours, and a static
 * location preview that links out to Google Maps.
 *
 * The opening hours are deliberately NOT listed here — see /hours and the
 * footer. This section says where the studio is and that it works by
 * appointment; the week itself is detail, and rendering it here filled the
 * column with "Closed".
 */
export async function FindUs() {
  const [t, profile] = await Promise.all([
    getTranslations("findUs"),
    getBusinessProfile(),
  ])
  const address = oneLineAddress(profile)
  const mapsUrl = mapsUrlFor(profile)

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          accent={t("headingAccent")}
          accentTone="secondary"
        />

        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* No address configured → no address block. Better an absent line
              than a blank one where a street should be. */}
          {address ? (
            <address className="max-w-sm font-editorial text-2xl not-italic leading-snug text-foreground">
              {profile.addressLine1}
              {profile.addressLine2 ? (
                <>
                  <br />
                  {profile.addressLine2}
                </>
              ) : null}
            </address>
          ) : null}
          <div className="space-y-2 font-functional text-sm text-muted-foreground">
            {/* No day-by-day list here. A studio that opens two days a week
                showed five rows of "Closed", which reads as shut rather than
                as by-appointment. The week lives in the footer and on /hours. */}
            <div>{t("hoursNote")}</div>
            <ArrowLink href={routes.hours}>{t("hoursLink")}</ArrowLink>
            {profile.contactEmail ? (
              <a
                href={`mailto:${profile.contactEmail}`}
                className="mt-2 block underline underline-offset-2 hover:text-foreground"
              >
                {profile.contactEmail}
              </a>
            ) : null}
          </div>
        </div>

        {/* The picture is the business's own upload, else the generic
            illustration shipped with the app — never a live embed, which would
            send every visitor's details to a mapping company.

            It renders whether or not there is an address: only the LINK OUT
            needs one, and hiding the picture because the street lines are blank
            made an uploaded image vanish with no explanation. */}
        <div className="relative aspect-[5/2] w-full overflow-hidden bg-muted">
          <Image
            src={profile.mapImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 896px, 100vw"
            // The shipped fallback is an SVG, and the optimizer refuses those
            // without `dangerouslyAllowSVG`. Uploads are raster and go through
            // it normally.
            unoptimized={profile.mapImageUrl.endsWith(".svg")}
            className="object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,18,0.06)_0%,rgba(18,18,18,0.18)_100%)]"
          />
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t("openMaps")}
              className="group absolute inset-0 z-10 flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-sm border border-background/65 bg-background/12 px-4 py-2 font-functional text-xs uppercase tracking-widest-lux text-background backdrop-blur-[4px] transition-colors group-hover:bg-background/20">
                {t("openMaps")}
                <HoverArrow />
              </span>
            </a>
          ) : null}
        </div>
      </Container>
    </Section>
  )
}
