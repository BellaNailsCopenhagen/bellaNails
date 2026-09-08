import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { BookingProtectionSettings } from "@/app/admin/settings/_components/booking-protection"
import { FeatureSettings } from "@/app/admin/settings/_components/feature-settings"
import { getBookingProtectionForAdmin } from "@/modules/booking/protection"
import { getFeatureFlags } from "@/modules/studio"

export const metadata: Metadata = { title: "App settings" }
export const dynamic = "force-dynamic"

/**
 * App settings — how the software behaves: how hard it is to book, and which
 * optional features are on. The studio's own details (address, contacts,
 * social) live at /admin/business. Owner-gated by the proxy.
 */
export default async function AdminSettingsPage() {
  const [flags, { protection, humanCheckAvailable }] = await Promise.all([
    getFeatureFlags(),
    getBookingProtectionForAdmin(),
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

      <BookingProtectionSettings
        protection={protection}
        humanCheckAvailable={humanCheckAvailable}
      />

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
