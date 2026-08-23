"use client"

import { ChevronRight } from "lucide-react"

import { PriceTag } from "@/components/ui/price-tag"
import { EmptyState } from "@/components/ui/empty-state"
import { Caption } from "@/components/ui/typography"

import type { CategoryGroup, ServiceOption } from "./types"

/**
 * Step 2 — pick one service, grouped by category (menu order). Selecting a
 * service triggers its add-ons load in the parent.
 */
export function ServiceStep({ categories, onSelect }: {
  categories: CategoryGroup[]
  onSelect: (service: ServiceOption) => void
}) {
  if (!categories.length) {
    return (
      <EmptyState
        title="No services"
        body="Add a bookable service in Services before booking one."
      />
    )
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category.id} className="space-y-2">
          <Caption className="block text-[10px] tracking-widest-lux">
            {category.name}
          </Caption>
          <ul className="border-t border-border">
            {category.services.map((service) => (
              <li key={service.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => onSelect(service)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-functional text-sm text-foreground">
                      {service.name}
                    </span>
                    <span className="font-functional text-xs text-muted-foreground">
                      {service.durationMins} min
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PriceTag cents={service.priceCents} className="text-sm" />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
