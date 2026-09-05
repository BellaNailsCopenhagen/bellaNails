"use server"

import { issueHumanChallenge } from "@/modules/identity/human-check"
import type { HumanChallenge } from "@/shared/human-check"

/**
 * Hand the browser a challenge to solve. Public by necessity — it is what the
 * widget on a booking form calls before anyone is signed in.
 *
 * Deliberately unrated: it writes nothing, holds nothing, and costs one HMAC
 * plus one hash. The work it hands back is the expensive half, and that lands
 * on the caller.
 */
export async function requestHumanChallenge(): Promise<HumanChallenge | null> {
  return issueHumanChallenge()
}
