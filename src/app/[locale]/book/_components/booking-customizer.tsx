"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/shared/cn"
import { Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/booking/appointment-summary"
import type { BookingLineItem } from "@/shared/booking-totals"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { BodySm, Caption } from "@/components/ui/typography"
import { routes } from "@/config/routes"

/**
 * BookingCustomizer — the interactive half of the customise step: toggle
 * add-ons, live price/duration totals, and incompatibility locking (an addon
 * incompatible with a selected one is disabled with a note naming it).
 * Continue carries the selection to step 02 via the URL
 * (`?service=…&addons=a,b&step=details`).
 */
export function BookingCustomizer({
  service,
  addons,
  incompatiblePairs,
  initialSelectedIds = [],
}: {
  service: BookingLineItem
  addons: BookingLineItem[]
  incompatiblePairs: [string, string][]
  /** Preselected add-ons (sanitized upstream) — back-nav and rebook links. */
  initialSelectedIds?: string[]
}) {
  const t = useTranslations("booking")
  const tCatalog = useTranslations("services")
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds),
  )

  const addonById = new Map(addons.map((addon) => [addon.id, addon]))

  /** The addon in `selection` that `addonId` clashes with, if any. */
  const blockerFor = (addonId: string, selection: ReadonlySet<string>) => {
    for (const [a, b] of incompatiblePairs) {
      if (a === addonId && selection.has(b)) {
        return addonById.get(b)
      }
      if (b === addonId && selection.has(a)) {
        return addonById.get(a)
      }
    }

    return undefined
  }

  const toggle = (addonId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(addonId)) {
        next.delete(addonId)
      } else if (!blockerFor(addonId, next)) {
        // Guard against `next`, not the render snapshot: two clicks can land
        // in one commit, before `disabled` has re-rendered onto the blocked
        // checkbox — checking the snapshot would let an incompatible pair in.
        next.add(addonId)
      }

      return next
    })
  }

  const selectedAddons = addons.filter((addon) => selected.has(addon.id))

  return (
    <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
      <div className="w-full space-y-10 md:max-w-[25rem]">
        {addons.length ? (
          <ul>
            {addons.map((addon) => {
              const isSelected = selected.has(addon.id)
              const blocker = isSelected
                ? undefined
                : blockerFor(addon.id, selected)

              return (
                <li key={addon.id}>
                  <label
                    className={cn(
                      "-mx-4 flex items-center gap-4 rounded-sm px-4 py-5 transition-colors",
                      blocker
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-muted/60",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(addon.id)}
                      disabled={Boolean(blocker)}
                    />
                    <span className="flex-1 space-y-1">
                      <BodySm as="span" className="block text-foreground">
                        {addon.name}
                      </BodySm>
                      <Caption className="block text-[11px] tracking-wide">
                        +{addon.durationMins} {tCatalog("minutes")}
                        {blocker
                          ? ` · ${t("incompatible", { name: blocker.name })}`
                          : null}
                      </Caption>
                    </span>
                    <PriceTag
                      cents={addon.priceCents}
                      sign
                      className="text-lg"
                    />
                  </label>
                  <Separator />
                </li>
              )
            })}
          </ul>
        ) : (
          <BodySm>{t("noAddons")}</BodySm>
        )}

        {/* Under the choices, on the left — the same column the details step
            puts its submit in, so the CTA doesn't jump sides between steps. */}
        <Button
          size="lg"
          nativeButton={false}
          render={
            <Link
              href={{
                pathname: routes.book,
                query: {
                  service: service.id,
                  step: "details",
                  ...(selectedAddons.length
                    ? { addons: selectedAddons.map((a) => a.id).join(",") }
                    : {}),
                },
              }}
            />
          }
        >
          {t("toDetailsCta")}
        </Button>
      </div>

      <AppointmentSummary service={service} selectedAddons={selectedAddons} />
    </div>
  )
}
