import {
  Ban,
  CircleCheck,
  CircleDashed,
  Clock,
  Globe,
  TriangleAlert,
  Undo2,
  Unlink,
  type LucideIcon,
} from "lucide-react"

import type { AssetState } from "@/shared/asset-state"

/**
 * The face each asset state wears. The rule itself — what the states are and how
 * a photo lands in one — is in shared/asset-state.ts; this is only the icon and
 * tint the hub draws it with.
 *
 * Favourites and set-aside are deliberately absent: both are the artist's own
 * filing, they apply in any state, and they render as their own controls rather
 * than competing with the state badge.
 */
export const STATE_ICON: Record<
  AssetState,
  { Icon: LucideIcon; className: string }
> = {
  unlinked: { Icon: Unlink, className: "text-warning" },
  to_ask: { Icon: CircleDashed, className: "text-muted-foreground/60" },
  waiting: { Icon: Clock, className: "text-warning" },
  ready: { Icon: CircleCheck, className: "text-secondary-foreground" },
  live: { Icon: Globe, className: "text-success" },
  declined: { Icon: Ban, className: "text-muted-foreground/50" },
  retracted: { Icon: Undo2, className: "text-warning/80" },
  takedown: { Icon: TriangleAlert, className: "text-destructive" },
}
