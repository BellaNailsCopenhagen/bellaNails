"use client"

import { useState, type ReactNode } from "react"

import { TabBar } from "@/components/ui/tab-bar"
import { CreateServiceSheet } from "@/components/admin/create-service-sheet"
import { EditAddonSheet } from "@/components/admin/edit-addon-sheet"

type TabValue = "services" | "addons"

/**
 * Services / Add-ons tabs. The content of each tab is server-rendered and
 * passed in; this only owns the active tab and the New button (which switches
 * to "New service" or "New add-on" with the tab).
 */
export function ServicesTabs({
  servicesCount,
  addonsCount,
  newServiceCategories,
  servicesContent,
  addonsContent,
}: {
  servicesCount: number
  addonsCount: number
  newServiceCategories: { id: string; name_en: string }[]
  servicesContent: ReactNode
  addonsContent: ReactNode
}) {
  const [tab, setTab] = useState<TabValue>("services")

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <TabBar
          tabs={[
            { value: "services", label: "Services", count: servicesCount },
            { value: "addons", label: "Add-ons", count: addonsCount },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "services" ? (
          <CreateServiceSheet categories={newServiceCategories} />
        ) : (
          <EditAddonSheet triggerLabel="New add-on" />
        )}
      </div>

      {tab === "services" ? servicesContent : addonsContent}
    </div>
  )
}
