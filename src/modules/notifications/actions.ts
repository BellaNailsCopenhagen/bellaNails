"use server"

import { revalidatePath } from "next/cache"

import {
  deleteNotification,
  markAllRead,
  setNotificationRead as setNotificationReadRow,
} from "@/db/owner-notifications"
import { requireOwner } from "@/modules/identity/require-owner"
import { routes } from "@/shared/routes"

export type NotificationActionResult = { ok: true } | { ok: false; error: string }

function revalidateNotifications(): void {
  revalidatePath(routes.admin.notifications)
  revalidatePath(routes.admin.home)
}

/** Mark every unread owner notification read (from the notifications page). */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await markAllRead(supabase)
  if (!saved.ok) return { ok: false, error: "Couldn’t update notifications." }

  revalidateNotifications()
  return { ok: true }
}

/** Mark one notification read or unread (per-item control). */
export async function setNotificationRead(
  id: string,
  read: boolean,
): Promise<NotificationActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await setNotificationReadRow(supabase, id, read)
  if (!saved.ok) return { ok: false, error: "Couldn’t update the notification." }

  revalidateNotifications()
  return { ok: true }
}

/** Remove one notification (dismiss) — e.g. a booking request already handled
    from the email, so it never clears itself in-app. */
export async function dismissNotification(
  id: string,
): Promise<NotificationActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await deleteNotification(supabase, id)
  if (!saved.ok) return { ok: false, error: "Couldn’t remove the notification." }

  revalidateNotifications()
  return { ok: true }
}
