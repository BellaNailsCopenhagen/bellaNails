"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Settings } from "lucide-react"

import { TabBar, tabTriggerClassName } from "@/components/ui/tab-bar"
import { cn } from "@/lib/utils"

export type BookingsTabKey = "bookings" | "gallery" | "requests" | "settings"

/**
 * My Space tabs: Appointments · Gallery · Requests, with a settings gear pinned
 * to the far right for account settings. Each panel is server-rendered and
 * passed in as a slot; this only switches which shows. Initial tab comes from
 * `?tab=` (the home banner deep-links to Requests).
 */
export function BookingsTabs({
  defaultTab,
  galleryCount,
  requestCount,
  bookings,
  gallery,
  requests,
  settings,
}: {
  defaultTab: BookingsTabKey
  galleryCount: number
  requestCount: number
  bookings: ReactNode
  gallery: ReactNode
  requests: ReactNode
  settings: ReactNode
}) {
  const t = useTranslations("bookings")
  const [tab, setTab] = useState<BookingsTabKey>(defaultTab)

  return (
    <div className="space-y-6">
      <TabBar
        tabs={[
          { value: "bookings", label: t("tabBookings") },
          {
            value: "gallery",
            label: t("tabGallery"),
            count: galleryCount || undefined,
          },
          {
            value: "requests",
            label: t("tabRequests"),
            count: requestCount || undefined,
          },
        ]}
        active={tab}
        onChange={setTab}
        trailing={
          <button
            type="button"
            role="tab"
            aria-selected={tab === "settings"}
            aria-label={t("tabSettings")}
            title={t("tabSettings")}
            onClick={() => setTab("settings")}
            className={cn(tabTriggerClassName(tab === "settings"), "ml-auto")}
          >
            <Settings className="size-4" />
          </button>
        }
      />
      <div>
        {tab === "settings"
          ? settings
          : tab === "gallery"
            ? gallery
            : tab === "requests"
              ? requests
              : bookings}
      </div>
    </div>
  )
}
