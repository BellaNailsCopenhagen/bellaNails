import Link from "next/link"
import { Bell, CalendarDays } from "lucide-react"

import { SendRemindersButton } from "@/app/admin/_components/send-reminders-button"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/typography"
import { routes } from "@/shared/routes"

const shortcut =
  "flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 font-functional text-sm text-foreground transition-colors hover:bg-muted"

/** Reminders + jump-off shortcuts. New booking is already the bottom-bar action;
    the useful extras here are the reminder batch, Notifications, and the Agenda. */
export function CommandActions({ unreadCount }: { unreadCount: number }) {
  return (
    <section className="space-y-3">
      <Eyebrow as="h3">Reminders &amp; actions</Eyebrow>
      <SendRemindersButton />
      <div className="grid grid-cols-2 gap-2">
        <Link href={routes.admin.notifications} className={shortcut}>
          <Bell className="size-4" />
          Notifications
          {unreadCount > 0 ? (
            <Badge variant="warning" size="xs">
              {unreadCount}
            </Badge>
          ) : null}
        </Link>
        <Link href={routes.admin.agenda} className={shortcut}>
          <CalendarDays className="size-4" />
          Agenda
        </Link>
      </div>
    </section>
  )
}
