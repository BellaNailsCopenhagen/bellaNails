"use client"

import { useState, type ReactNode } from "react"

import { TabBar } from "@/components/ui/tab-bar"
import { CreateServiceSheet } from "@/app/admin/services/_components/create-service-sheet"
import { EditCategorySheet } from "@/app/admin/services/_components/edit-category-sheet"
import { EditAddonSheet } from "@/components/admin/edit-addon-sheet"

type TabValue = "services" | "addons" | "categories"

/**
 * Services / Add-ons / Categories tabs. The content of each tab is
 * server-rendered and passed in; this only owns the active tab and the New
 * button, which creates whatever the current tab lists.
 */
export function ServicesTabs({
  servicesCount,
  addonsCount,
  categoriesCount,
  newServiceCategories,
  servicesContent,
  addonsContent,
  categoriesContent,
}: {
  servicesCount: number
  addonsCount: number
  categoriesCount: number
  newServiceCategories: { id: string; name_en: string }[]
  servicesContent: ReactNode
  addonsContent: ReactNode
  categoriesContent: ReactNode
}) {
  const [tab, setTab] = useState<TabValue>("services")

  const newAction = {
    services: <CreateServiceSheet categories={newServiceCategories} />,
    addons: <EditAddonSheet triggerLabel="New add-on" />,
    categories: <EditCategorySheet triggerLabel="New category" />,
  }[tab]

  const content = {
    services: servicesContent,
    addons: addonsContent,
    categories: categoriesContent,
  }[tab]

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <TabBar
          tabs={[
            { value: "services", label: "Services", count: servicesCount },
            { value: "addons", label: "Add-ons", count: addonsCount },
            {
              value: "categories",
              label: "Categories",
              count: categoriesCount,
            },
          ]}
          active={tab}
          onChange={setTab}
        />
        {newAction}
      </div>

      {content}
    </div>
  )
}
