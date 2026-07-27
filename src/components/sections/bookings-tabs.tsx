"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

import { TabBar } from "@/components/ui/tab-bar"

export type BookingsTabKey = "bookings" | "gallery" | "requests"

/**
 * Client-facing tabs on /bookings: Bookings · Gallery · Requests. The three
 * sections are server-rendered and passed in as slots; this only switches which
 * shows. Initial tab comes from the `?tab=` param, so the home banner can
 * deep-link straight to Requests.
 */
export function BookingsTabs({
  defaultTab,
  galleryCount,
  requestCount,
  bookings,
  gallery,
  requests,
}: {
  defaultTab: BookingsTabKey
  galleryCount: number
  requestCount: number
  bookings: ReactNode
  gallery: ReactNode
  requests: ReactNode
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
      />
      <div>
        {tab === "bookings" ? bookings : tab === "gallery" ? gallery : requests}
      </div>
    </div>
  )
}
