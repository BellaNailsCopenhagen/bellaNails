"use client"

import { useEffect, useState } from "react"

import { formatPrice } from "@/components/ui/price-tag"
import { getPriceHistory } from "@/modules/catalog/service-actions"
import type { PriceEntity, PricePoint } from "@/db/price-history"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * Read-only price history for a catalog item, loaded lazily when the edit
 * dialog opens (it mounts with the dialog). Renders nothing while loading or
 * when empty, so it never adds noise for items with no recorded changes.
 */
export function PriceHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: PriceEntity
  entityId: string
}) {
  const [entries, setEntries] = useState<PricePoint[] | null>(null)

  useEffect(() => {
    let active = true
    getPriceHistory(entityType, entityId).then((data) => {
      if (active) setEntries(data)
    })
    return () => {
      active = false
    }
  }, [entityType, entityId])

  if (!entries?.length) return null

  return (
    <div className="space-y-1.5">
      <p className="font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
        Price history
      </p>
      <ul className="space-y-1">
        {entries.map((entry, index) => (
          <li
            key={`${entry.changedAt}-${index}`}
            className="flex items-baseline justify-between gap-3 font-functional text-xs"
          >
            <span className={index === 0 ? "text-foreground" : "text-muted-foreground"}>
              {formatPrice(entry.priceCents)}
            </span>
            <span className="text-muted-foreground">
              {formatStudioDayMonthYear(
                new Date(entry.changedAt).getTime(),
                ADMIN_LOCALE,
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
