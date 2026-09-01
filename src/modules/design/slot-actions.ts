"use server"

import { getOffer } from "@/db/offers"
import {
  getOverrideSlotsForDuration,
  getSlotsForDuration,
} from "@/modules/booking/availability"
import { requireOwner } from "@/modules/identity/require-owner"
import type { Slot } from "@/shared/booking-slots"

/**
 * Free times for placing an offer as the artist. Takes the OFFER id, not a
 * duration: how long an appointment runs is read from the offer server-side, so
 * a crafted call can't ask for slots of an arbitrary length.
 *
 * `override` ignores hours and days off (the urgent path) — taken slots are
 * still excluded, and the overlap constraint remains the backstop on write.
 */
export async function getOwnerOfferSlots(
  offerId: string,
  override = false,
): Promise<Slot[]> {
  const db = await requireOwner()
  if (!db) return []

  const offer = await getOffer(db, offerId)
  if (!offer || offer.duration_mins <= 0) return []

  return override
    ? getOverrideSlotsForDuration(offer.duration_mins, db)
    : getSlotsForDuration(offer.duration_mins, db, { ignoreLeadTime: true })
}
