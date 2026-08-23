"use client"

import { Label } from "@/components/ui/label"
import { fieldLabel } from "@/components/admin/field-label"

export type CategoryOption = {
  id: string
  name_en: string
  archived_at?: string | null
}

/**
 * The category picker on both service sheets — a service belongs to at most
 * one. An archived option is still listed and labelled, so saving a service
 * that sits in a retired category doesn't silently unfile it.
 */
export function CategorySelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: CategoryOption[]
  onChange: (categoryId: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className={fieldLabel}>
        Category
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-sm border border-border bg-transparent px-3 py-2 font-functional text-sm text-foreground"
      >
        <option value="">Uncategorized</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.archived_at
              ? `${category.name_en} (archived)`
              : category.name_en}
          </option>
        ))}
      </select>
    </div>
  )
}
