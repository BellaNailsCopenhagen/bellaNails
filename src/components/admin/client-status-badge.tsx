import { Badge } from "@/components/ui/badge"

/**
 * Activated vs booking-only, at a glance. An activated client has signed into
 * their own account, so contacting them outside a booking is on firmer footing;
 * a booking-only account was provisioned by a reservation and never used.
 */
export function ClientStatusBadge({ activated }: { activated: boolean }) {
  return activated ? (
    <Badge variant="success" size="xs">
      Activated
    </Badge>
  ) : (
    <Badge variant="outline" size="xs">
      Booking-only
    </Badge>
  )
}
