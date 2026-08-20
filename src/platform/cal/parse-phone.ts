/**
 * Cal exposes the attendee phone under different keys — `responses` (webhook
 * payload) and `bookingFieldsResponses` (API v2 booking), each either a string
 * or `{ value }`. One extractor so a shape change is a single edit; the
 * booking-field answer wins over the attendee record.
 */

type CalPhoneSource = {
  responses?: { attendeePhoneNumber?: unknown }
  bookingFieldsResponses?: { attendeePhoneNumber?: unknown }
  attendees?: ({ phoneNumber?: string | null } | undefined)[]
}

function answerValue(answer: unknown): string | undefined {
  if (typeof answer === "string") return answer || undefined
  if (answer && typeof answer === "object" && "value" in answer) {
    const value = (answer as { value?: unknown }).value
    return value == null ? undefined : String(value) || undefined
  }
  return undefined
}

export function calBookingPhone(source: CalPhoneSource): string | undefined {
  return (
    answerValue(source.responses?.attendeePhoneNumber) ??
    answerValue(source.bookingFieldsResponses?.attendeePhoneNumber) ??
    source.attendees?.[0]?.phoneNumber ??
    undefined
  )
}
