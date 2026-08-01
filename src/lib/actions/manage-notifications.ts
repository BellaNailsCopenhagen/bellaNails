"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"

export type NotificationActionResult = { ok: true } | { ok: false; error: string }

/** Mark every unread owner notification read (from the notifications page). */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("owner_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
  if (error) return { ok: false, error: "Couldn’t update notifications." }

  revalidatePath("/admin/notifications")
  revalidatePath("/admin")
  return { ok: true }
}
