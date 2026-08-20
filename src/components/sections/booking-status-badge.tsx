import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { BOOKING_STATUS } from "@/shared/booking-status"

/** DB statuses plus the derived "completed" (past + not cancelled — shown,
    never stored). New statuses must be added here to render at all. */
const STATUS_VARIANT = {
  [BOOKING_STATUS.confirmed]: "success",
  [BOOKING_STATUS.rescheduled]: "warning",
  [BOOKING_STATUS.cancelled]: "destructive",
  completed: "success",
} as const

type DisplayStatus = keyof typeof STATUS_VARIANT

/** Localized, color-coded status chip. Typed so an unknown status is a
    compile error at the call site, not a silently green badge. */
function BookingStatusBadge({
  status,
  size = "xs",
  className,
}: {
  status: DisplayStatus
  size?: React.ComponentProps<typeof Badge>["size"]
  className?: string
}) {
  const t = useTranslations("bookings")
  return (
    <Badge variant={STATUS_VARIANT[status]} size={size} className={className}>
      {t(`status.${status}`)}
    </Badge>
  )
}

export { BookingStatusBadge }
export type { DisplayStatus }
