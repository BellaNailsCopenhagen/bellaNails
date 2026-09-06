import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { BodySm, Eyebrow, H2 } from "@/components/ui/typography"
import { BusinessSettings } from "@/app/admin/business/_components/business-settings"
import { getBusinessProfileForAdmin } from "@/modules/business"

export const metadata: Metadata = { title: "Business" }
export const dynamic = "force-dynamic"

/**
 * The business's own details — where it is, how to reach it, where it is
 * online. Kept apart from App settings on purpose: this is who the studio IS
 * and changes when the studio changes, while App settings is how the software
 * behaves. Mixing them makes one long screen where neither is findable.
 *
 * Owner-gated by the proxy.
 */
export default async function AdminBusinessPage() {
  const { values, mapImageUrl, heroBackground } =
    await getBusinessProfileForAdmin()

  return (
    <div className="space-y-8">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Business</H2>
        <BodySm className="text-xs">
          Your address, your email addresses and your social accounts. These show
          on the website and in the emails clients receive.
        </BodySm>
      </div>

      <BusinessSettings
        profile={values}
        mapImageUrl={mapImageUrl}
        heroBackground={heroBackground}
      />
    </div>
  )
}
