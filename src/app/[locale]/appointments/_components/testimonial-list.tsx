import type { AdminTestimonial } from "@/shared/testimonial"
import { contactDisplayName, type ClientContact } from "@/shared/contact"

/** The neighbourhoods are the ones `docs/seo-plan.md` targets. They live here
 * rather than in a catalogue because they are place names, identical in both
 * languages, and not copy anyone translates.
 */

// One label per state, so the badge and the controls can't disagree.
const BADGE: Record<
  AdminTestimonial["state"],
  { tone: "success" | "outline" | "destructive"; label: string }
> = {
  showing: { tone: "success", label: "On the home page" },
  waiting: { tone: "outline", label: "Not showing" },
  takenDown: { tone: "destructive", label: "Taken down by the client" },
  removed: { tone: "outline", label: "Removed" },
  erased: { tone: "destructive", label: "Erased at their request" },
}

/** Why a row has no controls left. Closing a row the client already ended would
 * overwrite their decision, so `declineTestimonial` refuses these too.
 */
const CLOSED_NOTE: Partial<Record<AdminTestimonial["state"], string>> = {
  takenDown: "They retracted permission — only they can put it back.",
  erased: "They asked us to erase the words, so there is nothing left to show.",
}

/** Records that the client has read their threads — the panel only mounts when
 * its tab is showing, so mounting IS the reading.
 */
export function DesignThreadsSeen({ seenAt }: { seenAt: string | null }) {