"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

import { useSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * Global "to review" bar in the admin shell — shows unread notifications on
 * EVERY admin page (except the notifications page itself). Re-checks on
 * navigation and once a minute so it clears/updates without a hard reload.
 * Owner-reads-all RLS scopes the count. Degrade-safe: a read error → hidden.
 */
export function AdminReviewBanner() {
  const supabase = useSupabaseBrowserClient()
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const { count, error } = await supabase
        .from("owner_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
      if (active) setUnread(error ? 0 : (count ?? 0))
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [supabase, pathname])

  if (unread <= 0 || pathname === "/admin/notifications") return null

  return (
    <Link
      href="/admin/notifications"
      className="flex items-center gap-2 border-b border-border bg-secondary/10 px-4 py-2.5 font-functional text-sm text-foreground transition-colors hover:bg-secondary/20"
    >
      <Bell className="size-4 shrink-0 text-secondary" />
      {unread === 1
        ? "1 notification to review"
        : `${unread} notifications to review`}
      <span className="ml-auto text-xs uppercase tracking-widest-lux text-muted-foreground">
        Review
      </span>
    </Link>
  )
}
