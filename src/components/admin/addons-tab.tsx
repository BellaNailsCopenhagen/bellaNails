"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PriceTag } from "@/components/ui/price-tag"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  EditAddonSheet,
  type EditableAddon,
} from "@/components/admin/edit-addon-sheet"
import { archiveAddon } from "@/lib/actions/manage-services"

export type ManageableAddon = EditableAddon & { archived_at: string | null }

/**
 * The Add-ons tab: standalone add-ons (edit / archive). Incompatibilities are
 * managed per add-on inside its edit dialog ("can't be combined with"), which
 * scales better than the old all-pairs matrix. Every change resyncs services.
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

  // The active add-ons this one can't combine with, resolved from the pairs.
  const partnersOf = (id: string) =>
    incompatiblePairs
      .filter(([a, b]) => a === id || b === id)
      .map(([a, b]) => (a === id ? b : a))

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
                    otherAddons={active
                      .filter((a) => a.id !== addon.id)
                      .map((a) => ({ id: a.id, name_en: a.name_en }))}
                    incompatibleIds={partnersOf(addon.id)}
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
    </div>
  )
}
