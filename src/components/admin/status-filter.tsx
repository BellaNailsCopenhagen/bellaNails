"use client"

import { ChevronDown, ListFilter } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BookingState } from "@/lib/booking-display"

// Lifecycle states: Open = still to come, Completed = already happened.
const STATE_LABELS: readonly (readonly [BookingState, string])[] = [
  ["open", "Open"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["no-show", "No-show"],
]

/** Every state, selected by default — callers seed their Set from this. */
export const ALL_BOOKING_STATES: readonly BookingState[] = STATE_LABELS.map(
  ([state]) => state,
)

/**
 * Multi-select state filter — all states shown by default; deselect to hide.
 * Shared by the Appointments browse and a client's history so both filter by
 * the same vocabulary (`bookingState`). The menu stays open while toggling.
 */
export function StatusFilter({
  selected,
  onToggle,
}: {
  selected: Set<BookingState>
  onToggle: (state: BookingState, checked: boolean) => void
}) {
  const all = selected.size === ALL_BOOKING_STATES.length
  const label = all ? "All statuses" : `${selected.size} of ${ALL_BOOKING_STATES.length}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Filter by status"
        className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground data-[popup-open]:text-foreground"
      >
        <ListFilter className="size-3.5" />
        {label}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATE_LABELS.map(([state, stateLabel]) => (
          <DropdownMenuCheckboxItem
            key={state}
            checked={selected.has(state)}
            onCheckedChange={(checked) => onToggle(state, checked)}
            className="text-[0.625rem]"
          >
            {stateLabel}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
