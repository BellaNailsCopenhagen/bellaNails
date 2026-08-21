import Link from "next/link"

import { PriceTag } from "@/components/ui/price-tag"
import type { AdminService } from "@/modules/catalog"

/**
 * One line in the services list — name, duration, price. The whole row opens
 * the service detail. Presentational (no client state) so both the server list
 * and the client Archived toggle reuse it.
 */
export function ServiceRow({ service }: { service: AdminService }) {
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
          <p className="mt-0.5 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            {service.base_duration_mins} min
          </p>
        </div>
        <PriceTag cents={service.base_price_cents} className="shrink-0 text-base" />
      </Link>
    </li>
  )
}
