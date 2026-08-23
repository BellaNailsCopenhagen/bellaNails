"use server"

import { revalidatePath } from "next/cache"

import { markAllRead } from "@/db/owner-notifications"
import { requireOwner } from "@/modules/identity/require-owner"
import { routes } from "@/shared/routes"

export type NotificationActionResult = { ok: true } | { ok: false; error: string }

/** Mark every unread owner notification read (from the notifications page). */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await markAllRead(supabase)
  if (!saved.ok) return { ok: false, error: "Couldn’t update notifications." }

  revalidatePath(routes.admin.notifications)
  revalidatePath(routes.admin.home)
  return { ok: true }
}
