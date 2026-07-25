"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Checkbox } from "@/components/ui/checkbox"
import { PriceTag } from "@/components/ui/price-tag"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  EditAddonSheet,
  type EditableAddon,
} from "@/components/admin/edit-addon-sheet"
import { archiveAddon, setAddonCompatibility } from "@/lib/actions/manage-services"

const pairKey = (a: string, b: string) => [a, b].sort().join(":")

export type ManageableAddon = EditableAddon & { archived_at: string | null }

/**
 * The Add-ons tab: standalone add-ons (edit / archive) and the GLOBAL
 * incompatibility selector — tick two add-ons that can't be booked together
 * (applies wherever both are linked). Every change resyncs affected services.
 */
export function AddonsTab({
  addons,
  incompatiblePairs,
}: {
  addons: ManageableAddon[]
  incompatiblePairs: [string, string][]
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const active = addons.filter((a) => !a.archived_at)
  const incompatible = new Set(incompatiblePairs.map(([a, b]) => pairKey(a, b)))

  const pairs: [ManageableAddon, ManageableAddon][] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      pairs.push([active[i], active[j]])
    }
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) toast.error(result.error || "Something went wrong.")
      else router.refresh()
    })

  return (
    <div className="space-y-8">
      <section className="space-y-2 pl-2">
        <div className="flex items-center gap-2">
          <Eyebrow as="h3">Add-ons</Eyebrow>
          <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            {active.length}
          </span>
        </div>
        {active.length ? (
          <ul className="space-y-2">
            {active.map((addon) => (
              <li
                key={addon.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-functional text-sm text-foreground">
                    {addon.name_en}
                  </p>
                  <p className="font-functional text-xs text-muted-foreground">
                    <PriceTag
                      cents={addon.extra_price_cents}
                      sign
                      className="text-xs"
                    />
                    {" · "}
                    {addon.extra_duration_mins > 0
                      ? `+${addon.extra_duration_mins} min`
                      : "no extra time"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <EditAddonSheet
                    addon={addon}
                    triggerLabel="Edit"
                    triggerVariant="ghost"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => archiveAddon(addon.id, true))}
                    className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <BodySm className="text-xs">No add-ons yet.</BodySm>
        )}
      </section>

      {pairs.length ? (
        <section className="space-y-2 pl-2">
          <Eyebrow as="h3">Incompatible pairs</Eyebrow>
          <BodySm className="text-xs">
            Tick two add-ons that can’t be booked together.
          </BodySm>
          <ul className="space-y-2">
            {pairs.map(([a, b]) => {
              const inc = incompatible.has(pairKey(a.id, b.id))
              return (
                <li key={pairKey(a.id, b.id)}>
                  <label className="flex items-center gap-2 font-functional text-sm text-foreground">
                    <Checkbox
                      checked={inc}
                      onCheckedChange={() =>
                        run(() => setAddonCompatibility(a.id, b.id, !inc))
                      }
                      disabled={pending}
                    />
                    <span>
                      {a.name_en}{" "}
                      <span className="text-muted-foreground">✕</span>{" "}
                      {b.name_en}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
