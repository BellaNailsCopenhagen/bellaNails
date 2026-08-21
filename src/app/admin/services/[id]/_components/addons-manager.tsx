"use client"

import { PriceTag } from "@/components/ui/price-tag"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  EditAddonSheet,
  type EditableAddon,
} from "@/components/admin/edit-addon-sheet"
import { useActionRunner } from "@/hooks/use-action-runner"
import { linkAddon, unlinkAddon } from "@/modules/catalog/addon-actions"

/**
 * Add-ons linked to one service. Add-ons are standalone now (managed on the
 * Add-ons tab, incompatibilities included) — here we just link existing ones or
 * create-and-link a new one, and unlink.
 */
export function AddonsManager({
  serviceId,
  addons,
  allAddons,
}: {
  serviceId: string
  /** Add-ons currently linked to this service. */
  addons: EditableAddon[]
  /** Every add-on, for the "link existing" picker. */
  allAddons: (EditableAddon & { archived_at: string | null })[]
}) {
  const { pending, run } = useActionRunner()

  const linkedIds = new Set(addons.map((a) => a.id))
  const linkable = allAddons.filter((a) => !a.archived_at && !linkedIds.has(a.id))

  return (
    <section className="space-y-2 pl-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eyebrow as="h3">Add-ons</Eyebrow>
          <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            {addons.length}
          </span>
        </div>
        <EditAddonSheet linkToServiceId={serviceId} triggerLabel="New add-on" />
      </div>

      {addons.length ? (
        <ul className="space-y-2">
          {addons.map((addon) => (
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
                  onClick={() => run(() => unlinkAddon(serviceId, addon.id))}
                  className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
                >
                  Unlink
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No add-ons linked.</BodySm>
      )}

      {linkable.length ? (
        <div className="pt-1">
          <select
            aria-label="Link an existing add-on"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const id = e.target.value
              if (id) run(() => linkAddon(serviceId, id))
              e.target.value = ""
            }}
            className="rounded-sm border border-border bg-transparent px-3 py-1.5 font-functional text-xs text-muted-foreground"
          >
            <option value="">Link existing add-on…</option>
            {linkable.map((addon) => (
              <option key={addon.id} value={addon.id}>
                {addon.name_en}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </section>
  )
}
