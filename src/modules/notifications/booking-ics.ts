import { STUDIO_ADDRESS } from "@/config/studio"

/**
 * A minimal RFC 5545 calendar invite for a booking, attached to booking emails
 * so the client can add the appointment in one tap (and drop it on cancel). The
 * UID is stable (`<bookingId>@bellanails.dk`) and SEQUENCE increments per build,
 * so a reschedule updates — and a cancel removes — the same event in clients
 * that honour it. Best-effort: any failure returns undefined and the email still
 * sends without it.
 */

// ISO instant → the UTC "basic format" a VEVENT wants (20260822T103000Z).
function icsUtc(iso: string): string | null {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

// Escape a TEXT value per RFC 5545 (backslash, semicolon, comma, newline).
function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

// Fold a content line at 75 octets (continuations begin with a space), counting
// bytes so a multi-byte character (ø, å) is never split across the fold.
function fold(line: string): string {
  const out: string[] = []
  let cur = ""
  let bytes = 0
  for (const ch of line) {
    const b = Buffer.byteLength(ch)
    const limit = out.length === 0 ? 75 : 74 // continuation lines lose 1 to the space
    if (bytes + b > limit) {
      out.push(cur)
      cur = ch
      bytes = b
    } else {
      cur += ch
      bytes += b
    }
  }
  out.push(cur)
  return out.join("\r\n ")
}

export function buildBookingIcs(e: {
  bookingId: string
  startIso: string
  endIso: string
  serviceName: string
  // A cancellation invite (METHOD:CANCEL + STATUS:CANCELLED) removes the entry
  // a prior PUBLISH added — same UID, higher SEQUENCE, so clients supersede it.
  cancelled?: boolean
}): string | undefined {
  const nowMs = Date.now()
  const dtStart = icsUtc(e.startIso)
  const dtEnd = icsUtc(e.endIso)
  const dtStamp = icsUtc(new Date(nowMs).toISOString())
  if (!dtStart || !dtEnd || !dtStamp) return undefined

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bella Nails//Booking//EN",
    `METHOD:${e.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${e.bookingId}@bellanails.dk`,
    // Seconds-since-epoch — rises with each (re)build so a later invite supersedes.
    `SEQUENCE:${Math.floor(nowMs / 1000)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsText(e.serviceName)}`,
    `LOCATION:${icsText(STUDIO_ADDRESS)}`,
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
}
