import { localeUrl } from "@/config/site"
import { STUDIO_NAME } from "@/config/studio"
import { routes } from "@/config/routes"
import { getBusinessProfile } from "@/modules/business/profile"
import { getSchedule } from "@/modules/studio"
import { localBusinessSchema } from "@/shared/local-business"

/**
 * `NailSalon` structured data for the home page — invisible to a visitor and
 * the one thing a local search actually reads.
 *
 * The neighbourhoods are the ones `docs/seo-plan.md` targets. They live here
 * rather than in a catalogue because they are place names, identical in both
 * languages, and not copy anyone translates.
 */
const AREA_SERVED = [
  "Ørestad",
  "Bella Kvarter",
  "Amager",
  "København S",
  "Islands Brygge",
]

export async function LocalBusinessSchema({ locale }: { locale: string }) {
  const [profile, schedule] = await Promise.all([
    getBusinessProfile(),
    getSchedule(),
  ])

  const schema = localBusinessSchema({
    name: STUDIO_NAME,
    url: localeUrl(locale, routes.home),
    profile,
    schedule,
    areaServed: AREA_SERVED,
  })

  return (
    <script
      type="application/ld+json"
      // Built from our own two tables, and JSON.stringify escapes what goes in.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
