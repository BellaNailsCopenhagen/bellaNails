import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

/**
 * Client contact resolved live from Clerk — never persisted (the no-PII rule:
 * our DB holds only the pseudonymous `clerk_user_id`). Used by the admin queue
 * to show who each appointment is with + tap-to-call/email.
 */
export type ClientContact = {
  firstName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
}

// Clerk's getUserList caps a page at 500; a studio's upcoming-queue client set
// is far below that. If it ever isn't, contacts beyond the first page won't
// resolve (cards fall back to "Client") — paginate then.
const MAX_USERS = 500

/**
 * Batch-resolve `clerk_user_id → contact` for a set of bookings in one call.
 * A failure degrades to an empty map (cards show "Client") rather than
 * throwing — a Clerk hiccup must not blank the whole queue.
 */
export async function fetchClientContacts(
  clerkUserIds: (string | null | undefined)[],
): Promise<Record<string, ClientContact>> {
  const ids = [...new Set(clerkUserIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}

  const contacts: Record<string, ClientContact> = {}
  try {
    const client = await clerkClient()
    const { data } = await client.users.getUserList({
      userId: ids,
      limit: Math.min(ids.length, MAX_USERS),
    })
    for (const user of data) {
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null
      const phone =
        user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId)
          ?.phoneNumber ??
        user.phoneNumbers[0]?.phoneNumber ??
        null
      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null
      contacts[user.id] = {
        firstName: user.firstName ?? null,
        fullName,
        email,
        phone,
      }
    }
  } catch (error) {
    console.error(
      "[admin-queue] contact resolution failed",
      error instanceof Error ? error.message : error,
    )
  }
  return contacts
}
