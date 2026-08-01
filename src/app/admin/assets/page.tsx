import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { AssetUsageManager } from "@/components/admin/asset-usage-manager"
import { getSharedAssets } from "@/lib/admin/assets"
import { fetchClientContacts } from "@/lib/clerk/client-contacts"
import { contactDisplayName } from "@/lib/clerk/contact"
import { formatStudioDayMonthYear } from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

export const metadata: Metadata = { title: "Assets" }
export const dynamic = "force-dynamic"

/**
 * Shared-asset overview — every image a client has approved for publishing,
 * newest first. Each is "unlinked" until the artist places it on a use-case
 * (clients gallery, showcase, social). Owner-gated by the proxy.
 */
export default async function AdminAssetsPage() {
  const assets = await getSharedAssets()
  const ids = [...new Set(assets.map((a) => a.clerkUserId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}

  return (
    <div className="space-y-6">
      <Link
        href="/admin/more"
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Shared assets</H2>
        <BodySm className="text-xs">
          Images clients have approved for publishing. Place each where you want
          it used — nothing is published until you do.
        </BodySm>
      </div>

      {assets.length ? (
        <ul className="space-y-6">
          {assets.map((asset) => (
            <li
              key={asset.assetId}
              className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt="Shared asset"
                className="aspect-square w-full shrink-0 rounded-sm border border-border object-cover sm:size-28"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-functional text-sm font-medium text-foreground">
                    {contactDisplayName(contacts[asset.clerkUserId])}
                  </span>
                  <Badge variant="outline" size="xs">
                    {asset.purpose === "some" ? "social" : "website"}
                  </Badge>
                  {asset.usages.length === 0 ? (
                    <Badge variant="warning" size="xs">
                      unlinked
                    </Badge>
                  ) : null}
                  {asset.grantedAt ? (
                    <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                      {formatStudioDayMonthYear(
                        new Date(asset.grantedAt).getTime(),
                        ADMIN_LOCALE,
                      )}
                    </span>
                  ) : null}
                </div>
                <AssetUsageManager
                  assetId={asset.assetId}
                  purpose={asset.purpose}
                  usages={asset.usages}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No shared assets yet"
          body="When a client approves a photo for publishing, it appears here to place."
        />
      )}
    </div>
  )
}
