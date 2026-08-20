import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { AssetHubTabs, type HubFilter } from "@/components/admin/asset-hub-tabs"
import { getHubAssets } from "@/modules/media/asset-hub"
import { SIMPLE_ORDER, toSimpleState } from "@/components/admin/asset-state"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { contactDisplayName } from "@/shared/contact"

export const metadata: Metadata = { title: "Assets" }
export const dynamic = "force-dynamic"

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

  const ids = [...new Set(assets.map((a) => a.clientId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}
  const clientNames: Record<string, string> = {}
  for (const id of ids) clientNames[id] = contactDisplayName(contacts[id])

  // Deep-link from a booking card lands on the highlighted asset's own state;
  // else honour a valid ?tab=; else open on "Needs takedown" when any photo
  // needs one (urgent — a client withdrew a live social photo); else All.
  const highlighted = highlight
    ? assets.find((a) => a.mediaId === highlight)
    : undefined
  const hasTakedown = assets.some((a) => toSimpleState(a.state) === "takedown")
  const defaultTab: HubFilter = highlighted
    ? toSimpleState(highlighted.state)
    : (SIMPLE_ORDER as readonly string[]).includes(tab ?? "")
      ? (tab as HubFilter)
      : hasTakedown
        ? "takedown"
        : "all"

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
