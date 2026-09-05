import "server-only"

import { SMTP_ACCOUNT_EMAIL } from "@/config/studio"
import { getBusinessProfile } from "@/modules/business/profile"

/**
 * Which addresses this send should use.
 *
 * The studio's own, if she has set them (Admin → More → Business);
 * otherwise the compiled-in constants, so mail keeps working before the row
 * exists. Resolved per send rather than at import, because a change has to take
 * effect without a deploy — that was the point of making them editable.
 *
 * Two addresses, not one:
 *   `booking`  — transactional confirmations. A send-as alias, so it can read
 *                as the booking system rather than as her.
 *   `contact`  — everything conversational, and the reply-to on all of it.
 *                A reply arriving from a booking robot reads as the wrong
 *                sender, and a reply nobody reads is worse.
 */
export async function mailFrom(
  kind: "booking" | "contact",
): Promise<{ from: string; replyTo: string }> {
  const profile = await getBusinessProfile()
  const chosen =
    kind === "booking" ? profile.bookingFromEmail : profile.contactEmail
  return {
    // The envelope — unlike the displayed address — may fall back to the SMTP
    // account, because an unsendable `from` fails the whole message.
    from: chosen || SMTP_ACCOUNT_EMAIL,
    replyTo: profile.contactEmail || SMTP_ACCOUNT_EMAIL,
  }
}

/**
 * Where the app writes TO the owner — a client wrote back, a request needs
 * reviewing.
 *
 * Its own setting, not the public contact address: this is mail for a person,
 * and a `To:` carries none of the send-as constraints a `From` does, so it can
 * be a personal mailbox. Falls back to the contact address.
 */
export async function businessInbox(): Promise<string> {
  return (await getBusinessProfile()).alertEmail || SMTP_ACCOUNT_EMAIL
}
