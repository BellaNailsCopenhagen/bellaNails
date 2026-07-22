import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import { toE164 } from "@/lib/contact-validation"

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>

type EnsureClerkUserInput = {
  email: string
  /** Full display name as typed by the client ("Anna Jensen"). */
  name?: string
  /** Phone as typed by the client — attached best-effort (must be E.164). */
  phone?: string
}

/** "Anna Marie Jensen" → { firstName: "Anna", lastName: "Marie Jensen" }. */
function splitName(name: string | undefined) {
  const [firstName, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean)
  return { firstName, lastName: rest.length ? rest.join(" ") : undefined }
}

/**
 * Phone numbers are free-typed by clients and Clerk requires E.164 — an
 * invalid value must never fail a booking sync, so this is best-effort.
 */
async function tryAttachPhone(
  client: ClerkClient,
  userId: string,
  phone: string | undefined,
) {
  const normalized = toE164(phone)
  if (!normalized) return
  try {
    await client.phoneNumbers.createPhoneNumber({
      userId,
      phoneNumber: normalized,
    })
  } catch {
    // Duplicate/rejected phone — the booking sync proceeds without it.
  }
}

/**
 * Create-or-find the client's Clerk user by email — the keystone of the
 * identity model: PII (name/email/phone) lives in Clerk, our DB stores only
 * the returned pseudonymous `clerk_user_id`.
 *
 * Created users are passwordless (they later sign in with an email code, or
 * Google/Apple on the same address — verified-email account linking merges
 * them). Existing profiles are **filled-if-empty only**: values the client
 * set themselves are never clobbered by booking data.
 *
 * Used by the Cal webhook (booking sync) and the booking-flow account opt-in.
 */
export async function ensureClerkUser({
  email,
  name,
  phone,
}: EnsureClerkUserInput): Promise<string> {
  const client = await clerkClient()
  const normalizedEmail = email.trim().toLowerCase()
  const { firstName, lastName } = splitName(name)

  const existing = (
    await client.users.getUserList({ emailAddress: [normalizedEmail] })
  ).data[0]

  if (!existing) {
    try {
      const user = await client.users.createUser({
        emailAddress: [normalizedEmail],
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        skipPasswordRequirement: true,
        // Distinguish booking-provisioned accounts from client-created ones.
        privateMetadata: { source: "booking-auto" },
      })
      await tryAttachPhone(client, user.id, phone)
      return user.id
    } catch (error) {
      // Check-then-create race: a concurrent delivery (or the account
      // opt-in) created the user between our lookup and createUser. Clerk
      // rejects the duplicate email — re-fetch and use the winner.
      const raced = (
        await client.users.getUserList({ emailAddress: [normalizedEmail] })
      ).data[0]
      if (raced) return raced.id
      throw error
    }
  }

  const patch = {
    ...(!existing.firstName && firstName ? { firstName } : {}),
    ...(!existing.lastName && lastName ? { lastName } : {}),
  }
  if (Object.keys(patch).length) {
    await client.users.updateUser(existing.id, patch)
  }
  if (existing.phoneNumbers.length === 0) {
    await tryAttachPhone(client, existing.id, phone)
  }
  return existing.id
}
