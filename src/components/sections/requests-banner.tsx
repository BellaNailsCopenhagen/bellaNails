"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Bell, ChevronRight } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { pendingRequestCount } from "@/modules/media/consent-requests"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useSupabaseBrowserClient } from "@/platform/supabase/client"
import { routes } from "@/config/routes"

/**
 * One banner covering ALL of a client's pending consent requests, at the top of
 * the home page. Client component so the page stays static — signed-out
 * visitors and clients with nothing pending render nothing. Tapping opens the
 * Requests tab on /bookings.
 */
export function RequestsBanner() {
  const { clientId } = useCurrentUser()
  const t = useTranslations("bookings")
  const supabase = useSupabaseBrowserClient()

  const { data: count = 0 } = useQuery({
    queryKey: ["pending-requests", clientId],
    queryFn: () => pendingRequestCount(supabase, clientId!),
    enabled: Boolean(clientId),
  })

  if (!clientId || count <= 0) return null

  return (
    <Link
      href={{ pathname: routes.appointments, query: { tab: "requests" } }}
      className="flex items-center gap-3 border-b border-border bg-secondary/10 px-6 py-3 font-functional text-sm text-foreground transition-colors hover:bg-secondary/20"
    >
      <Bell className="size-4 shrink-0 text-secondary" />
      <span className="min-w-0 flex-1">
        {t("requestBanner", { count })}
        <span className="text-muted-foreground"> — {t("requestBannerTap")}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
