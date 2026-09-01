import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { FeatureSettings } from "@/app/admin/settings/_components/feature-settings"
import { getFeatureFlags } from "@/modules/studio"

export const metadata: Metadata = { title: "App settings" }
export const dynamic = "force-dynamic"

/**
 * App settings — the Features area: each app feature flag as a checkbox with a
 * short description of what it turns on. Owner-gated by the proxy.
 */
export default async function AdminSettingsPage() {
  const flags = await getFeatureFlags()

  return (
    <div className="space-y-6">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>App</Eyebrow>
        <H2>App settings</H2>
        <BodySm className="text-xs">
          Turn optional features on or off for the whole app.
        </BodySm>
      </div>

      <FeatureSettings flags={flags} />
    </div>
  )
}
