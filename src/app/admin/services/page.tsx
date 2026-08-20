import type { Metadata } from "next"

import { Eyebrow, H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { ArchivedServices } from "@/components/admin/archived-services"
import { AddonsTab } from "@/components/admin/addons-tab"
import { ServiceRow } from "@/components/admin/service-row"
import { ServicesTabs } from "@/components/admin/services-tabs"
import {
  getAdminCatalog,
  getAllAddons,
  getAllIncompatibilities,
  type AdminService,
} from "@/modules/catalog"

export const metadata: Metadata = { title: "Services" }

// Owner-gated route reading the catalog service-role — always dynamic.
export const dynamic = "force-dynamic"

function CategorySection({
  label,
  services,
}: {
  label: string
  services: AdminService[]
}) {
  if (services.length === 0) return null
  return (
    <section className="space-y-2 pl-2">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow as="h3">{label}</Eyebrow>
        <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
          {services.length}
        </span>
      </div>
      <ul>
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </ul>
    </section>
  )
}

function Header() {
  return (
    <div className="space-y-0.5">
      <Eyebrow>Studio menu</Eyebrow>
      <H2>Services</H2>
      <p className="font-editorial text-2xl italic leading-none text-muted-foreground">
        &amp; add-ons
      </p>
    </div>
  )
}

export default async function AdminServicesPage() {
  let catalog
  let allAddons
  let incompatiblePairs: [string, string][]
  try {
    ;[catalog, allAddons, incompatiblePairs] = await Promise.all([
      getAdminCatalog(),
      getAllAddons(),
      getAllIncompatibilities(),
    ])
  } catch (error) {
    console.error(
      "[admin-services] read failed",
      error instanceof Error ? error.message : error,
    )
    return (
      <div className="space-y-10">
        <Header />
        <ErrorState
          title="Couldn’t load the catalog"
          body="Something went wrong reaching your services. Try again in a moment."
        />
      </div>
    )
  }

  const { categories, uncategorized } = catalog
  const active = (services: AdminService[]) =>
    services.filter((s) => !s.archived_at)
  const archived = [
    ...categories.flatMap((c) => c.services),
    ...uncategorized,
  ].filter((s) => s.archived_at)

  const servicesCount =
    active(uncategorized).length +
    categories.reduce((n, c) => n + active(c.services).length, 0)
  const activeAddons = allAddons.filter((a) => !a.archived_at)

  const servicesContent =
    servicesCount === 0 && archived.length === 0 ? (
      <EmptyState title="No services yet" body="Your catalog will appear here." />
    ) : (
      <div className="space-y-14">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            label={category.name_en}
            services={active(category.services)}
          />
        ))}
        <CategorySection label="Uncategorized" services={active(uncategorized)} />
        <ArchivedServices services={archived} />
      </div>
    )

  return (
    <div className="space-y-10">
      <Header />
      <ServicesTabs
        servicesCount={servicesCount}
        addonsCount={activeAddons.length}
        newServiceCategories={categories
          .filter((c) => !c.archived_at)
          .map((c) => ({ id: c.id, name_en: c.name_en }))}
        servicesContent={servicesContent}
        addonsContent={
          <AddonsTab addons={allAddons} incompatiblePairs={incompatiblePairs} />
        }
      />
    </div>
  )
}
