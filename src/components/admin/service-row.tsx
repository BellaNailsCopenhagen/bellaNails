import Link from "next/link"

import { PriceTag } from "@/components/ui/price-tag"
import type { AdminService } from "@/lib/admin/catalog"

/**
 * One line in the services list — name, duration + Cal sync state, price.
 * The whole row opens the service detail. Presentational (no client state) so
 * both the server list and the client Archived toggle reuse it.
 */
export function ServiceRow({ service }: { service: AdminService }) {
  // Real create/patch/failed states arrive with the Cal sync engine; for now a
  // service with a Cal event slug is synced, otherwise it needs one.
  const synced = Boolean(service.cal_event_slug)
  return (
    <li className="border-b border-border">
      <Link
        href={`/admin/services/${service.id}`}
        className="flex items-center justify-between gap-4 py-3"
      >
        <div className="min-w-0">
          <p className="truncate font-functional text-sm text-foreground">
            {service.name_en}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            <span>{service.base_duration_mins} min</span>
            <span aria-hidden>·</span>
            <span className={synced ? "text-success" : "text-warning"}>
              {synced ? "Synced" : "Not synced"}
            </span>
          </p>
        </div>
        <PriceTag cents={service.base_price_cents} className="shrink-0 text-base" />
      </Link>
    </li>
  )
}
