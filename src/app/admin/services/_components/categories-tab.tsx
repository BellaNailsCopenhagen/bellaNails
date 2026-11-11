"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { BodySm } from "@/components/ui/typography"
import {
  EditCategorySheet,
  type EditableCategory,
} from "@/app/admin/services/_components/edit-category-sheet"
import { useActionRunner } from "@/hooks/use-action-runner"
import { archiveCategory } from "@/modules/catalog/category-actions"
import { useCategoryReorder } from "@/hooks/use-category-reorder"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export type ManageableCategory = EditableCategory & {
  archived_at: string | null
  serviceCount: number
}

const moveButton =
  "flex size-6 shrink-0 items-center justify-center rounded-full hover:border border-transparent disabled:opacity-30"

const linkButton =
  "font-functional text-[0.625rem] uppercase tracking-widest-lux transition-colors hover:text-foreground"

/**
 * The Categories tab: the public menu's top level. Order here IS the order the
 * menu numbers its sections in, so the list is reorderable. Archiving is soft —
 * an archived category (and everything filed under it) drops off the menu.
 */
export function CategoriesTab({
  categories: initialCategories,
}: {
  categories: ManageableCategory[]
}) {
  const { pending, run } = useActionRunner()
  const { categories: localCategories, handleMove } = useCategoryReorder(initialCategories)

  const [confirming, setConfirming] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = localCategories.filter((c) => !c.archived_at)
  const shown = showArchived ? localCategories : active

  if (localCategories.length === 0) {
    return (
      <BodySm className="text-xs">
        No categories yet — create one to group your services.
      </BodySm>
    )
  }

  return (
    <section className="space-y-3 pl-2">
      <p className="font-functional text-xs leading-relaxed text-muted-foreground">
        The order here IS the order the menu numbers its sections, so the list
        is reorderable. Use the buttons below to filter the view.
      </p>

      <div className="flex gap-2">
        <Button
          variant={"outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? " Only Active" : "Include Archived"}
        </Button>
      </div>

      <ul className="space-y-3">
        {shown.map((category, index) => {
          const archived = Boolean(category.archived_at)

          return (
            <li key={category.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${category.name_en} up`}
                      disabled={pending || index === 0}
                      onClick={() => handleMove(category.id, "up")}
                      className={moveButton}
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${category.name_en} down`}
                      disabled={pending || index === shown.length - 1}
                      onClick={() => handleMove(category.id, "down")}
                      className={moveButton}
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  {category.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={category.image_url}
                      alt=""
                      className="size-10 shrink-0 rounded-sm border border-border object-cover"
                    />
                  ) : null}

                  <div className="min-w-0">
                    <p className="truncate font-functional text-sm text-foreground">
                      {category.name_en}
                      {archived ? " · archived" : ""}
                    </p>
                    <p className="font-functional text-xs text-muted-foreground">
                      {category.name_dk} ·{" "}
                      {category.serviceCount === 1
                        ? "1 service"
                        : `${category.serviceCount} services`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <EditCategorySheet
                    category={category}
                    triggerLabel="Edit"
                    triggerVariant="ghost"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onBlur={() => setConfirming(null)}
                    onClick={() => {
                      if (archived) {
                        run(() => archiveCategory(category.id, false))

                        return
                      }
                      if (confirming !== category.id) {
                        setConfirming(category.id)

                        return
                      }
                      setConfirming(null)
                      run(() => archiveCategory(category.id, true))
                    }}
                    className={
                      archived
                        ? `${linkButton} text-muted-foreground hover:text-foreground`
                        : `${linkButton} text-destructive/70 hover:text-destructive`
                    }
                  >
                    {archived
                      ? "Restore"
                      : confirming === category.id
                        ? `Confirm — hides ${category.serviceCount === 1 ? "1 service" : `${category.serviceCount} services`}`
                        : "Archive"}
                  </button>
                </div>
              </div>
              <Separator />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
