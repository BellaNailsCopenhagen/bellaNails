import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PriceTag } from "@/components/ui/price-tag"
import { Eyebrow, H2 } from "@/components/ui/typography"
import { AddonsManager } from "@/components/admin/addons-manager"
import { EditServiceSheet } from "@/components/admin/edit-service-sheet"
import { PriceHistoryPanel } from "@/components/admin/price-history-panel"
import { ServiceSectionsManager } from "@/components/admin/service-sections-manager"
import { ReviewsManager } from "@/components/admin/reviews-manager"
import { getAllAddons, getServiceDetail } from "@/lib/admin/catalog"
import { requireOwner } from "@/lib/admin/require-owner"
import { getConsentedAssets, getServiceSections } from "@/lib/service-sections"
import { getServiceReviews } from "@/lib/reviews"

export const metadata: Metadata = { title: "Service" }

// Owner-gated route reading the catalog service-role — always dynamic.
export const dynamic = "force-dynamic"

const subLabel =
  "font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground"

export default async function AdminServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getServiceDetail(id).catch((error) => {
    console.error(
      "[admin-service] read failed",
      error instanceof Error ? error.message : error,
    )
    return null
  })
  if (!detail) notFound()

  const { service, categoryName, validBookings } = detail
  const activeAddons = service.addons.filter((a) => !a.archived_at)
  const allAddons = await getAllAddons().catch(() => [])

  // Sections + the consented-photo pool for their image picker (owner client).
  const ownerClient = await requireOwner()
  const [sections, consentedAssets, reviews] = ownerClient
    ? await Promise.all([
        getServiceSections(ownerClient, service.id).catch(() => []),
        getConsentedAssets(ownerClient).catch(() => []),
        getServiceReviews(service.id, ownerClient).catch(() => []),
      ])
    : [[], [], []]

  return (
    <div className="space-y-14">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/services"
            className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Services
          </Link>
          <EditServiceSheet service={service} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Eyebrow>{categoryName ?? "Service"}</Eyebrow>
            <div className="flex flex-wrap items-center gap-2">
              <H2>{service.name_en}</H2>
              {service.archived_at ? (
                <Badge variant="outline" size="xs">
                  Archived
                </Badge>
              ) : null}
              {!service.cal_event_slug ? (
                <Badge variant="warning" size="xs">
                  No Cal event
                </Badge>
              ) : null}
            </div>
            <p className="font-functional text-sm text-muted-foreground">
              {service.name_dk}
            </p>
          </div>
          <div className="shrink-0 space-y-0.5 text-right">
            <PriceTag cents={service.base_price_cents} className="text-lg" />
            <p className={subLabel}>{service.base_duration_mins} min</p>
          </div>
        </div>

        <p className="font-functional text-xs text-muted-foreground">
          {validBookings} valid {validBookings === 1 ? "booking" : "bookings"}
        </p>
      </div>

      {service.description_en || service.description_dk ? (
        <section className="space-y-2 pl-2">
          <Eyebrow as="h3">Description</Eyebrow>
          <dl className="space-y-1.5">
            {service.description_en ? (
              <div className="flex gap-2">
                <dt className={`mt-0.5 shrink-0 ${subLabel}`}>EN</dt>
                <dd className="font-functional text-sm text-foreground/80">
                  {service.description_en}
                </dd>
              </div>
            ) : null}
            {service.description_dk ? (
              <div className="flex gap-2">
                <dt className={`mt-0.5 shrink-0 ${subLabel}`}>DK</dt>
                <dd className="font-functional text-sm text-muted-foreground">
                  {service.description_dk}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <AddonsManager
        serviceId={service.id}
        addons={activeAddons}
        allAddons={allAddons}
      />

      <ServiceSectionsManager
        serviceId={service.id}
        sections={sections}
        consentedAssets={consentedAssets}
      />

      <section className="space-y-2 pl-2">
        <Eyebrow as="h3">Price history</Eyebrow>
        <PriceHistoryPanel entityType="service" entityId={service.id} />
      </section>

      <ReviewsManager serviceId={service.id} reviews={reviews} />
    </div>
  )
}
