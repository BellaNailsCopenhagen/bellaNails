import {
  Ban,
  Circle,
  CircleCheck,
  Clock,
  Globe,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

/**
 * Simplified asset states for the hub. The read model derives 8 fine-grained
 * states; the artist only needs to know what ACTION a photo wants, so we fold
 * them into 6 buckets (declined/withdrawn/dismissed → one "inactive"). Each is
 * an icon + tooltip in the UI. Favourites are orthogonal — a photo can be a
 * favourite in any state. Client-safe (lucide icons render fine in RSC too).
 */
export type SimpleState =
  | "new"
  | "awaiting"
  | "ready"
  | "live"
  | "takedown"
  | "inactive"

export const SIMPLE_ORDER: readonly SimpleState[] = [
  "new",
  "awaiting",
  "ready",
  "live",
  "takedown",
  "inactive",
]

export const SIMPLE_LABEL: Record<SimpleState, string> = {
  new: "New",
  awaiting: "Awaiting",
  ready: "Ready",
  live: "Live",
  takedown: "Needs takedown",
  inactive: "Inactive",
}

export const SIMPLE_TOOLTIP: Record<SimpleState, string> = {
  new: "Fresh photo — no consent requested yet",
  awaiting: "Consent requested — waiting on the client",
  ready: "Client granted — ready to place on a surface",
  live: "In use on the website or social",
  takedown: "Client withdrew a social photo — remove the post, then confirm",
  inactive: "Declined, withdrawn, or dismissed",
}

/** Icon + tint per simplified state — shared by the card and the legend. */
export const STATE_ICON: Record<
  SimpleState,
  { Icon: LucideIcon; className: string }
> = {
  new: { Icon: Circle, className: "text-muted-foreground/50" },
  awaiting: { Icon: Clock, className: "text-warning" },
  ready: { Icon: CircleCheck, className: "text-secondary-foreground" },
  live: { Icon: Globe, className: "text-success" },
  takedown: { Icon: TriangleAlert, className: "text-destructive" },
  inactive: { Icon: Ban, className: "text-muted-foreground/40" },
}

/** Map a fine-grained hub state (asset-hub.ts) to its simplified bucket. */
export function toSimpleState(state: string): SimpleState {
  switch (state) {
    case "awaiting":
      return "awaiting"
    case "unlinked":
      return "ready"
    case "in_use":
      return "live"
    case "takedown":
      return "takedown"
    case "declined":
    case "withdrawn":
    case "dismissed":
      return "inactive"
    default:
      return "new"
  }
}
