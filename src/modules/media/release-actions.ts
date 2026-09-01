"use server"

import { revalidatePath } from "next/cache"

import { listMediaForBookings } from "@/db/client-media"
import {
  deleteAsset,
  flagAssetsTakedown,
  getAssetStorageKey,
  listAssetsForMediaByPurpose,
} from "@/db/assets"
import { getBookingOwner } from "@/db/bookings"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import {
  findRelease,
  listReleasesForBookings,
  updateRelease,
  upsertReleases,
  type ReleasePurpose,
} from "@/db/media-releases"
import { verifyBookingToken } from "@/modules/booking/manage-token"
import { getCurrentUser } from "@/modules/identity/server"
import { revalidatePublicSurfaces } from "@/modules/media/revalidate-surfaces"
import { notifyOwner } from "@/modules/notifications/notify"
import { deleteObject } from "@/platform/storage/supabase"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { MEDIA_RELEASE_CONSENT_VERSION } from "@/shared/media-release"
import { routes } from "@/shared/routes"

/**
 * The CLIENT's booking-level media RELEASE decisions — the documented consent to
 * use an appointment's photos + videos for a purpose (website / social /
 * education). Registered clients decide from My Space (ownership re-verified);
 * guests decide from the emailed public page (the signed token is the proof).
 * Granting only records permission — the artist publishes specific shots later.
 * Withdrawing un-publishes what that release authorized.
 */

export type ReleaseActionResult = { ok: true } | { ok: false; error: string }

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>

/** Un-publish everything a (booking, purpose) release authorized. website copies
    are deleted outright — unless the file delete fails, in which case the copy is
    kept and flagged rather than silently stranded; social copies are always kept
    and flagged for manual takedown
    (we can't remove an external post); education has no on-site copy. Returns
    true when a social copy was flagged, so the caller can alert the owner. */
async function unpublishBookingMedia(
  supabase: ServiceClient,
  bookingId: string,
  purpose: ReleasePurpose,
): Promise<boolean> {
  if (purpose === "education") return false

  const media = await listMediaForBookings(supabase, [bookingId])
  const mediaIds = media.map((m) => m.id)
  if (mediaIds.length === 0) return false

  const assets = await listAssetsForMediaByPurpose(supabase, mediaIds, purpose)
  if (assets.length === 0) return false

  if (purpose === "social") {
    // External posts can't be auto-removed — keep the copy, flag it so the hub
    // shows "taken down?" and the artist erases it once the post is gone.
    await flagAssetsTakedown(
      supabase,
      assets.map((a) => a.id),
      new Date().toISOString(),
    )
    return true
  }

  // website — fully unpublish (asset delete cascades its placements; the private
  // original in client_media is untouched).
  //
  // The PUBLIC FILE GOES FIRST, and the row only follows if that succeeded. The
  // row is the only thing that still points at the object: drop it while the
  // file survives and a photo whose consent was withdrawn stays world-readable
  // with nothing left to retry the delete. On failure we keep the row and flag
  // it, so the hub shows "taken down?" — the same escape hatch social uses — and
  // the artist can finish the job.
  let stranded = false
  for (const asset of assets) {
    const storageKey = asset.storage_key ?? (await getAssetStorageKey(supabase, asset.id))
    if (storageKey) {
      const removed = await deleteObject(storageKey)
      if (!removed.ok) {
        console.error(
          `[release] public object for asset ${asset.id} not deleted — kept + flagged:`,
          removed.error,
        )
        await flagAssetsTakedown(supabase, [asset.id], new Date().toISOString())
        stranded = true
        continue
      }
    }
    await deleteGalleryItemsForAsset(supabase, asset.id)
    await deleteAsset(supabase, asset.id)
  }
  return stranded
}

/** Apply a grant/decline to a release row (shared by the registered + guest
    paths). A DECLINE un-publishes anything already live (the recorded "no" and
    what's public must never disagree). Resets sibling timestamps so the audit
    row can't contradict itself. Returns true if anything was left needing the
    artist's hand — a social copy, or a website file that refused to delete. */
async function applyDecision(
  supabase: ServiceClient,
  releaseId: string,
  bookingId: string,
  purpose: ReleasePurpose,
  decision: "granted" | "declined",
): Promise<boolean> {
  let flaggedSocial = false
  if (decision === "declined") {
    flaggedSocial = await unpublishBookingMedia(supabase, bookingId, purpose)
  }
  const now = new Date().toISOString()
  const stamp =
    decision === "granted"
      ? {
          granted_at: now,
          declined_at: null,
          withdrawn_at: null,
          consent_version: MEDIA_RELEASE_CONSENT_VERSION,
        }
      : { declined_at: now, granted_at: null, withdrawn_at: null }
  await updateRelease(supabase, releaseId, { status: decision, ...stamp })
  return flaggedSocial
}

/** Registered client grants/declines one booking release from My Space. */
export async function decideMediaRelease(
  bookingId: string,
  purpose: ReleasePurpose,
  decision: "granted" | "declined",
): Promise<ReleaseActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const release = await findRelease(supabase, bookingId, purpose)
  if (!release || release.client_id !== user.id) {
    return { ok: false, error: "not_found" }
  }
  // Only a pending request is answerable here — a granted one is retracted via
  // withdraw, and a stale replay must never flip a withdrawn/declined row back.
  if (release.status !== "requested") return { ok: true }

  const flaggedSocial = await applyDecision(
    supabase,
    release.id,
    bookingId,
    purpose,
    decision,
  )
  revalidatePath(routes.admin.client(user.id))
  if (decision === "declined") {
    revalidatePath(routes.admin.assets)
    revalidatePublicSurfaces()
    if (flaggedSocial) {
      await notifyOwner(supabase, {
        kind: "media_consent_withdrawn",
        clientId: user.id,
        purpose,
      })
    }
  }
  return { ok: true }
}

/** Registered client withdraws a previously-granted booking release. */
export async function withdrawMediaRelease(
  bookingId: string,
  purpose: ReleasePurpose,
): Promise<ReleaseActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const release = await findRelease(supabase, bookingId, purpose)
  if (!release || release.client_id !== user.id) {
    return { ok: false, error: "not_found" }
  }

  await unpublishBookingMedia(supabase, bookingId, purpose)
  await updateRelease(supabase, release.id, {
    status: "withdrawn",
    withdrawn_at: new Date().toISOString(),
  })
  await notifyOwner(supabase, {
    kind: "media_consent_withdrawn",
    clientId: user.id,
    purpose,
  })

  revalidatePath(routes.admin.client(user.id))
  revalidatePath(routes.admin.assets)
  revalidatePublicSurfaces()
  return { ok: true }
}

/** Pre-approval from the confirmation page — the client grants purposes for their
    just-made booking (no media yet; the release is forward-covering). The signed
    booking token authorizes it (the page can be a guest). Grant-only: purposes
    the client leaves unticked get NO row, so the artist can request just those
    later. Optional + unbundled from the booking → GDPR-clean (Art. 7(4)). */
export async function preApproveRelease(
  token: string,
  purposes: ReleasePurpose[],
): Promise<ReleaseActionResult> {
  const bookingId = verifyBookingToken(token)
  if (!bookingId) return { ok: false, error: "invalid_link" }
  if (purposes.length === 0) return { ok: true }

  const supabase = createSupabaseServiceRoleClient()
  const booking = await getBookingOwner(supabase, bookingId)
  if (!booking) return { ok: false, error: "not_found" }

  // Never resurrect a purpose the client already declined or withdrew — grant
  // only undecided ones (absent or still requested). A replayed confirmation
  // link therefore can't overwrite a prior "no".
  const existing = await listReleasesForBookings(supabase, [bookingId])
  const blocked = new Set(
    existing
      .filter((r) => r.status === "withdrawn" || r.status === "declined")
      .map((r) => r.purpose),
  )
  const toGrant = purposes.filter((p) => !blocked.has(p))
  if (toGrant.length === 0) return { ok: true }

  const now = new Date().toISOString()
  const saved = await upsertReleases(
    supabase,
    toGrant.map((p) => ({
      booking_id: bookingId,
      client_id: booking.client_id,
      purpose: p,
      status: "granted" as const,
      requested_at: now,
      granted_at: now,
      declined_at: null,
      withdrawn_at: null,
      consent_version: MEDIA_RELEASE_CONSENT_VERSION,
    })),
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t save your choice." }

  revalidatePath(routes.admin.client(booking.client_id))
  return { ok: true }
}

/** Guest (no account) grants/declines from the emailed public page — the signed
    token stands in for auth. Applies each purpose's decision to that booking's
    pending release rows. */
export async function respondToReleaseToken(
  token: string,
  decisions: { purpose: ReleasePurpose; decision: "granted" | "declined" }[],
): Promise<ReleaseActionResult> {
  const bookingId = verifyBookingToken(token)
  if (!bookingId) return { ok: false, error: "invalid_link" }
  const supabase = createSupabaseServiceRoleClient()

  let clientId: string | null = null
  let flaggedSocial = false
  let declined = false
  for (const { purpose, decision } of decisions) {
    const release = await findRelease(supabase, bookingId, purpose)
    // Only a still-pending request is answerable — ignore anything already
    // decided so a replayed/forwarded link can't re-grant a withdrawn release.
    if (!release || release.status !== "requested") continue
    clientId = release.client_id
    if (decision === "declined") declined = true
    if (await applyDecision(supabase, release.id, bookingId, purpose, decision)) {
      flaggedSocial = true
    }
  }

  // Keep the admin views in step with the guest's decision (the registered path
  // gets this via revalidate too).
  if (clientId) {
    revalidatePath(routes.admin.client(clientId))
    revalidatePath(routes.admin.assets)
    if (declined) revalidatePublicSurfaces()
    if (flaggedSocial) {
      await notifyOwner(supabase, { kind: "media_consent_withdrawn", clientId })
    }
  }
  return { ok: true }
}
