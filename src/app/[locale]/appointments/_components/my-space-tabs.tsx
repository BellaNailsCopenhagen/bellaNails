"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { useTranslations } from "next-intl"
import { Settings } from "lucide-react"

import { AttentionBanner, bannerCard } from "@/components/ui/attention-banner"
import { HighlightTarget } from "@/components/ui/highlight-target"
import { TabBar, tabTriggerClassName } from "@/components/ui/tab-bar"
import { cn } from "@/shared/cn"
import { releaseCardId } from "@/shared/media-release"

/**
 * Jump to an appointment's permission card from anywhere inside the tabs — the
 * Gallery uses it so a photo leads to the control that can take it down.
 *
 * It is a callback and not a link BECAUSE the destination is this same page: a
 * navigation re-renders the server component but reconciles this one, whose tab
 * lives in state, so the URL would change and nothing else would. The same trap
 * the reply banner below was moved in here to escape.
 */
const JumpToPermissions = createContext<((bookingId: string) => void) | null>(
  null,
)

export const useJumpToPermissions = () => useContext(JumpToPermissions)

export type MySpaceTabKey =
  "bookings" | "ask" | "permissions" | "gallery" | "settings"

/**
 * My Space tabs: Appointments · Ask · Permissions · Gallery, with a settings
 * gear pinned to the far right. Each panel is server-rendered and passed in as a
 * slot; this only switches which shows. The initial tab comes from `?tab=`.
 *
 * Ask and Permissions sit left of Gallery because they are the two that can be
 * waiting on the client — the gallery only ever shows them what already exists.
 * They were one "Requests" tab until the split: a thread the client started and
 * a permission the studio wants are opposite errands, and stacking them meant
 * the badge could never say which had arrived.
 *
 * The "studio has replied" banner lives here rather than on the page above it so
 * it can call `setTab` — as a link to the page you are already on it was a no-op
 * whenever the URL already carried the tab.
 */
export function MySpaceTabs({
  defaultTab,
  defaultFocusBookingId,
  galleryCount,
  askCount,
  permissionCount,
  unreadReplies,
  bookings,
  ask,
  permissions,
  gallery,
  settings,
}: {
  defaultTab: MySpaceTabKey
  /** `?focus=` — arriving from outside, land on this appointment's card. */
  defaultFocusBookingId: string | null
  galleryCount: number
  /** Threads with a live offer or an answer the client hasn't read. */
  askCount: number
  /** Permissions waiting on a decision, plus a testimonial invitation. */
  permissionCount: number
  unreadReplies: number
  bookings: ReactNode
  ask: ReactNode
  permissions: ReactNode
  gallery: ReactNode
  settings: ReactNode
}) {
  const t = useTranslations("bookings")
  const tDesign = useTranslations("designRequests")
  const [tab, setTab] = useState<MySpaceTabKey>(defaultTab)
  // The nonce is what makes a second jump to the SAME card scroll again: the
  // highlight is an effect, and an unchanged id would not re-run it.
  const [focus, setFocus] = useState(() =>
    defaultFocusBookingId
      ? { bookingId: defaultFocusBookingId, nonce: 0 }
      : null,
  )

  const jumpToPermissions = useCallback((bookingId: string) => {
    setTab("permissions")
    setFocus((prev) => ({ bookingId, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])

  const panels: Record<MySpaceTabKey, ReactNode> = {
    bookings,
    ask,
    permissions,
    gallery,
    settings,
  }

  return (
    <JumpToPermissions.Provider value={jumpToPermissions}>
      <div className="space-y-6">
        {unreadReplies > 0 && tab !== "ask" ? (
          <AttentionBanner
            onClick={() => setTab("ask")}
            className={bannerCard}
            text={tDesign("bannerTitle")}
            tap={tDesign("bannerCta")}
          />
        ) : null}

        <TabBar
          tabs={[
            { value: "bookings", label: t("tabBookings") },
            { value: "ask", label: t("tabAsk"), count: askCount || undefined },
            {
              value: "permissions",
              label: t("tabPermissions"),
              count: permissionCount || undefined,
            },
            {
              value: "gallery",
              label: t("tabGallery"),
              count: galleryCount || undefined,
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
        <div>{panels[tab]}</div>
        {/* Mounted after the panel, so the card it scrolls to is in the DOM. */}
        <HighlightTarget
          key={focus?.nonce}
          elementId={focus ? releaseCardId(focus.bookingId) : null}
        />
      </div>
    </JumpToPermissions.Provider>
  )
}
