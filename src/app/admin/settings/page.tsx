import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { BookingProtectionSettings } from "@/app/admin/settings/_components/booking-protection"
import { FeatureSettings } from "@/app/admin/settings/_components/feature-settings"
import { getBookingProtectionSettings } from "@/modules/booking/protection"
import { getFeatureFlags } from "@/modules/studio"

export const metadata: Metadata = { title: "App settings" }
export const dynamic = "force-dynamic"

/**
 * App settings — booking protection (how hard it is to book, and who may not),
 * then the optional-feature switches. Owner-gated by the proxy.
 */
export default async function AdminSettingsPage() {
  const [flags, protection] = await Promise.all([
    getFeatureFlags(),
    getBookingProtectionSettings(),
  ])

  return (
    <div className="space-y-10">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>App</Eyebrow>
        <H2>App settings</H2>
        <BodySm className="text-xs">
          How clients book, and which optional features are on.
        </BodySm>
      </div>

      <BookingProtectionSettings protection={protection} />

      <div className="space-y-1 border-t border-border pt-6">
        <Eyebrow as="h2">Features</Eyebrow>
        <BodySm className="text-xs">
          Turn optional surfaces on or off for the whole app.
        </BodySm>
      </div>
      <FeatureSettings flags={flags} />
    </div>
  )
}
