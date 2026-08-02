import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { AssetHubTabs } from "@/components/admin/asset-hub-tabs"
import { getHubAssets, type HubState } from "@/lib/admin/asset-hub"
import { fetchClientContacts } from "@/lib/clerk/client-contacts"
import { contactDisplayName } from "@/lib/clerk/contact"

export const metadata: Metadata = { title: "Assets" }
export const dynamic = "force-dynamic"

const STATES: HubState[] = [
  "new",
  "awaiting",
  "unlinked",
  "in_use",
  "takedown",
  "declined",
  "withdrawn",
  "dismissed",
]

/**
 * The asset hub — every client image across all clients, tabbed by state. The
 * single place the artist manages consent + placement; the per-client gallery
 * is just an overview. Owner-gated by the proxy.
 */
export default async function AdminAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; highlight?: string }>
}) {
  const { tab, highlight } = await searchParams
  const assets = await getHubAssets()

  const ids = [...new Set(assets.map((a) => a.clerkUserId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}
  const clientNames: Record<string, string> = {}
  for (const id of ids) clientNames[id] = contactDisplayName(contacts[id])

  // Deep-link from a booking card lands on the highlighted asset's own tab.
  const highlighted = highlight
    ? assets.find((a) => a.mediaId === highlight)
    : undefined
  const defaultTab: HubState = highlighted
    ? highlighted.state
    : STATES.includes(tab as HubState)
      ? (tab as HubState)
      : "new"

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
        <H2>Assets</H2>
        <BodySm className="text-xs">
          Every client photo, across all clients. Tap one to manage consent and
          where it&rsquo;s used.
        </BodySm>
      </div>

      <AssetHubTabs
        assets={assets}
        clientNames={clientNames}
        defaultTab={defaultTab}
        highlight={highlight ?? null}
      />
    </div>
  )
}
