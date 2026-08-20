"use client"

import { useState, type ReactNode } from "react"

import { TabBar } from "@/components/ui/tab-bar"

type AdminClientTabKey = "appointment" | "gallery"

/**
 * Admin client page tabs: Appointment · Gallery. Both slots are rendered
 * upstream and switched here. English-only (the admin has no next-intl context).
 */
export function AdminClientTabs({
  appointment,
  gallery,
  galleryCount,
  defaultTab = "appointment",
}: {
  appointment: ReactNode
  gallery: ReactNode
  galleryCount: number
  defaultTab?: AdminClientTabKey
}) {
  const [tab, setTab] = useState<AdminClientTabKey>(defaultTab)

  return (
    <div className="space-y-6">
      <TabBar
        tabs={[
          { value: "appointment", label: "Appointment" },
          {
            value: "gallery",
            label: "Gallery",
            count: galleryCount || undefined,
          },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div>{tab === "appointment" ? appointment : gallery}</div>
    </div>
  )
}
