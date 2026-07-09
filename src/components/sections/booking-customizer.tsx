"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceTag } from "@/components/ui/price-tag";
import { Separator } from "@/components/ui/separator";
import { BodySm, Caption, Eyebrow, H3 } from "@/components/ui/typography";

/** Localized, display-ready line item — the server wrapper resolves `_en`/`_dk`. */
type CustomizerItem = {
  id: string;
  name: string;
  priceCents: number;
  durationMins: number;
};

/**
 * BookingCustomizer — the interactive half of the customise step: toggle
 * add-ons, live price/duration totals, and incompatibility locking (an addon
 * incompatible with a selected one is disabled with a note naming it).
 * Continue is disabled until the next step (details/time) ships.
 */
export function BookingCustomizer({
  service,
  addons,
  incompatiblePairs,
}: {
  service: CustomizerItem;
  addons: CustomizerItem[];
  incompatiblePairs: [string, string][];
}) {
  const t = useTranslations("booking");
  const tCatalog = useTranslations("services");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const addonById = new Map(addons.map((addon) => [addon.id, addon]));

  /** The addon in `selection` that `addonId` clashes with, if any. */
  const blockerFor = (addonId: string, selection: ReadonlySet<string>) => {
    for (const [a, b] of incompatiblePairs) {
      if (a === addonId && selection.has(b)) return addonById.get(b);
      if (b === addonId && selection.has(a)) return addonById.get(a);
    }
    return undefined;
  };

  const toggle = (addonId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else if (!blockerFor(addonId, next)) {
        // Guard against `next`, not the render snapshot: two clicks can land
        // in one commit, before `disabled` has re-rendered onto the blocked
        // checkbox — checking the snapshot would let an incompatible pair in.
        next.add(addonId);
      }
      return next;
    });
  };

  const selectedAddons = addons.filter((addon) => selected.has(addon.id));
  const totalCents =
    service.priceCents +
    selectedAddons.reduce((sum, addon) => sum + addon.priceCents, 0);
  const totalMins =
    service.durationMins +
    selectedAddons.reduce((sum, addon) => sum + addon.durationMins, 0);

  return (
    <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
      <div className="w-full max-w-[25rem] space-y-10">
        {addons.length ? (
          <ul>
            {addons.map((addon) => {
              const isSelected = selected.has(addon.id);
              const blocker = isSelected
                ? undefined
                : blockerFor(addon.id, selected);
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
                    <PriceTag cents={addon.priceCents} sign className="text-lg" />
                  </label>
                  <Separator />
                </li>
              );
            })}
          </ul>
        ) : (
          <BodySm>{t("noAddons")}</BodySm>
        )}

        {/* Enabled once step 02 (details/time) exists. */}
        <Button size="lg" disabled>
          {t("continue")}
        </Button>
      </div>

      <aside className="w-full max-w-[22.5rem] rounded-lg border border-border bg-muted/60 p-6 sm:p-8">
        <div className="space-y-6">
          <Eyebrow className="font-normal">{t("summaryLabel")}</Eyebrow>

          <div className="space-y-1">
            <H3>{service.name}</H3>
            <Caption className="block tracking-wide normal-case">
              {t("privateSession")}
            </Caption>
          </div>

          <div className="flex items-baseline justify-between">
            <Caption className="text-[10px] tracking-widest">
              {t("durationLabel")}
            </Caption>
            <Caption className="text-[10px] tracking-widest text-foreground">
              {totalMins} {tCatalog("minutes")}
            </Caption>
          </div>
          <Caption className="block text-[11px] tracking-wide normal-case">
            {t("timeNote")}
          </Caption>

          <Separator />

          <ul className="space-y-2">
            <li className="flex items-baseline justify-between gap-6">
              <BodySm className="text-foreground">{service.name}</BodySm>
              <PriceTag cents={service.priceCents} className="text-sm" />
            </li>
            {selectedAddons.map((addon) => (
              <li
                key={addon.id}
                className="flex items-baseline justify-between gap-6"
              >
                <BodySm>{addon.name}</BodySm>
                <PriceTag
                  cents={addon.priceCents}
                  sign
                  className="text-sm text-muted-foreground"
                />
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex items-baseline justify-between gap-6">
            <Eyebrow as="span">{t("totalLabel")}</Eyebrow>
            <PriceTag cents={totalCents} className="font-editorial text-2xl" />
          </div>

          <Caption className="block text-[11px] leading-relaxed tracking-wide normal-case">
            {t("paymentNote")}
          </Caption>
        </div>
      </aside>
    </div>
  );
}
