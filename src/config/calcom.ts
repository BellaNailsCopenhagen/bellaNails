/**
 * Cal.com wiring — the account lives on the EU data center, so every URL
 * points at the EU instance (never cal.com): booking pages on cal.eu, the
 * app/embed on app.cal.eu, API on api.cal.eu.
 *
 * `NEXT_PUBLIC_CALCOM_LINK` is the Cal username (e.g. `bellanails`); the
 * per-service event slug (`services.cal_event_slug`) is appended per booking.
 */
export const CALCOM_ORIGIN = "https://app.cal.eu";
export const CALCOM_EMBED_JS_URL = `${CALCOM_ORIGIN}/embed/embed.js`;
/** Public booking-page origin — reschedule/cancel links live here. */
export const CALCOM_BOOKING_ORIGIN = "https://cal.eu";

/**
 * The Cal username, or null when the env var is missing — callers (the /book
 * routing gate) must check this and degrade instead of rendering the confirm
 * step, so a misconfigured deploy can't 500 a user-facing page.
 */
export const CALCOM_USERNAME = process.env.NEXT_PUBLIC_CALCOM_LINK ?? null;

/** `bellanails/test-gel-extension` — the `calLink` for a service's event type. */
export function buildCalLink(eventSlug: string): string {
  if (!CALCOM_USERNAME) {
    throw new Error("NEXT_PUBLIC_CALCOM_LINK is not set");
  }
  return `${CALCOM_USERNAME}/${eventSlug}`;
}
