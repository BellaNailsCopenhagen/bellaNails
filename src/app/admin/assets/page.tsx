import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { AssetHubTabs, type HubFilter } from "@/app/admin/assets/_components/asset-hub-tabs"
import { getHubAppointments } from "@/modules/media/asset-hub"
import { ASSET_STATE_ORDER } from "@/shared/asset-state"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { contactDisplayName } from "@/shared/contact"

export const metadata: Metadata = { title: "Assets" }
export const dynamic = "force-dynamic"

/**
 * The asset hub — every photo the studio holds, across all clients, tabbed by
 * what it needs next. The single place the artist asks for permission and
 * decides where a photo is used; the per-client gallery is just an overview.
 * Owner-gated by the proxy.
 */
export default async function AdminAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; highlight?: string }>
}) {
  const { tab, highlight } = await searchParams
  const appointments = await getHubAppointments()
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()

  const ids = [...new Set(appointments.map((a) => a.clientId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}
  const clientNames: Record<string, string> = {}
  for (const id of ids) clientNames[id] = contactDisplayName(contacts[id])

  // A deep link from a booking thumbnail or a withdrawal alert lands on that
  // photo's own tab; otherwise honour a valid ?tab=; otherwise All. It no longer
  // jumps to "needs takedown" on its own — that used to be the only way to make
  // an urgent tab visible, and the banner says it out loud from wherever you are.
  const highlighted = highlight
    ? appointments.find((a) => a.photos.some((p) => p.mediaId === highlight))
    : undefined
  const isKnownTab = (value: string) =>
    value === "takedown" || (ASSET_STATE_ORDER as readonly string[]).includes(value)
  const defaultTab: HubFilter = highlighted
    ? highlighted.state
    : isKnownTab(tab ?? "")
      ? (tab as HubFilter)
      : "all"

  return (
    <div className="space-y-6">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Assets</H2>
        <BodySm className="text-xs">
          Your photos, appointment by appointment. Permission is given per
          appointment, so ask once here and it covers every photo from it.
        </BodySm>
      </div>

      <AssetHubTabs
        appointments={appointments}
        clientNames={clientNames}
        defaultTab={defaultTab}
        highlight={highlight ?? null}
        now={now}
      />
    </div>
  )
}
