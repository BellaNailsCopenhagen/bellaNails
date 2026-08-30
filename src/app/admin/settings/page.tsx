import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { FeatureSettings } from "@/app/admin/settings/_components/feature-settings"
import { getFeatureFlags } from "@/modules/studio"
import { routes } from "@/shared/routes"

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
      <Link
        href={routes.admin.more}
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

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
