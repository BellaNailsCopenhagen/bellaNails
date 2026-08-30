"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Eyebrow, BodySm } from "@/components/ui/typography"
import { setFeatureFlag } from "@/modules/studio/actions"
import type { FeatureFlag } from "@/shared/feature-flags"

const CATEGORY_LABEL: Record<string, string> = {
  booking: "Booking",
  general: "General",
}

/** The Features checklist — one checkbox + description per flag, grouped by
    category. Optimistic: flip immediately, revert on a failed/thrown save. */
export function FeatureSettings({ flags }: { flags: FeatureFlag[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(flags.map((f) => [f.key, f.enabled])),
  )
  const [pending, setPending] = useState<string | null>(null)

  const toggle = async (key: string, next: boolean) => {
    setEnabled((s) => ({ ...s, [key]: next }))
    setPending(key)
    try {
      const res = await setFeatureFlag(key, next)
      if (!res.ok) {
        setEnabled((s) => ({ ...s, [key]: !next }))
        toast.error(res.error || "Couldn’t update the setting.")
      }
    } catch {
      setEnabled((s) => ({ ...s, [key]: !next }))
      toast.error("Couldn’t update the setting.")
    } finally {
      setPending(null)
    }
  }

  if (!flags.length) {
    return <BodySm className="text-xs">No features to configure yet.</BodySm>
  }

  const categories = [...new Set(flags.map((f) => f.category))]

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category} className="space-y-3">
          <Eyebrow as="h2">{CATEGORY_LABEL[category] ?? category}</Eyebrow>
          <ul className="space-y-3">
            {flags
              .filter((f) => f.category === category)
              .map((f) => (
                <li key={f.key} className="rounded-lg border border-border p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={enabled[f.key] ?? false}
                      disabled={pending === f.key}
                      onChange={(e) => toggle(f.key, e.target.checked)}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="block font-functional text-sm font-medium text-foreground">
                        {f.label}
                      </span>
                      {f.description ? (
                        <span className="block font-functional text-xs text-muted-foreground">
                          {f.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
