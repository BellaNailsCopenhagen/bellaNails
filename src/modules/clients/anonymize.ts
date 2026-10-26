"use server"

import { revalidatePath } from "next/cache"
import { deleteBookingRequestsForClient } from "@/db/booking-requests"
import { deleteDesignRequestsForClient } from "@/db/design-requests"
import { deleteTestimonialsForClient } from "@/db/testimonials"
import { listDesignRefsForClient } from "@/db/design-refs"
import { clearClientNotes } from "@/db/bookings"
import type { Db } from "@/db/client"
import { deleteMedia, listOwnUploadsForClient } from "@/db/client-media"
import { anonymizeClientRow, getClientErasureState } from "@/db/clients"
import { scrubCommunicationsForClient } from "@/db/communications"
import { deleteNotesForClient } from "@/db/notes"
import { hasPublishedAssetForMedia } from "@/db/assets"
import { requireOwner } from "@/modules/identity/require-owner"
import { getCurrentUser } from "@/modules/identity/server"
import { purgeMediaArtifacts } from "@/modules/media/erasure"
import { revalidatePublicSurfaces } from "@/modules/revalidate"
import { purgeDesignRefsForClient } from "@/modules/design/refs"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { routes } from "@/shared/routes"

export type AnonymizeResult = { ok: true } | { ok: false; error: string }

type Admin = Db

/**
 * A client_media the artist is using or has curated — kept on erasure (the
 * client's lever for these is per-item consent withdrawal, not deletion).
 * Conservative: any grant / auto-place / publish / favourite signal keeps it.
 */
async function isArtistInUse(
  admin: Admin,
  media: { id: string; favorited_at: string | null },
): Promise<boolean> {
  if (media.favorited_at) {
    return true
  }

  return hasPublishedAssetForMedia(admin, media.id)
}

/**
 * GDPR erasure = ANONYMIZE, not hard-delete (see docs/tasks/PII-GDPR.md). Keeps
 * the client row + its bookings/consents/links (financial retention + proof),
 * scrubs the PII, removes the login, and deletes only the client's OWN unused
 * uploads. Artist-owned / published media stays. Idempotent.
 *
 * Never reports success while PII survives: if any storage object won't delete,
 * the auth account can't be removed, or a scrub fails, it aborts BEFORE stamping
 * `anonymized_at` so a re-run retries cleanly. Callers authorize first.
 */
async function runAnonymize(
  admin: Admin,
  clientId: string,
): Promise<AnonymizeResult> {
  try {
    const state = await getClientErasureState(admin, clientId)
    if (!state.ok) {
      return { ok: false, error: state.message }
    }
    const client = state.row
    if (!client) {
      return { ok: false, error: "client not found" }
    }
    if (client.anonymized_at) {
      return { ok: true }
    } // already anonymized

    // 1. Delete the client's OWN uploads the artist isn't using/curating.
    const ownMedia = await listOwnUploadsForClient(admin, clientId)
    for (const media of ownMedia) {
      if (await isArtistInUse(admin, media)) {
        continue
      }
      if (!(await purgeMediaArtifacts(media.id))) {
        return { ok: false, error: "storage delete failed — retry" }
      }
      const removed = await deleteMedia(admin, media.id)
      if (!removed.ok) {
        return { ok: false, error: removed.message! }
      }
    }

    // 2. Remove the login. 404 = already gone (idempotent retry); any other
    //    error must fail so the auth PII isn't silently left orphaned.
    if (client.auth_user_id) {
      const { error: authError } = await admin.auth.admin.deleteUser(
        client.auth_user_id,
      )
      const notFound =
        authError?.status === 404 ||
        /not.?found/i.test(authError?.message ?? "")
      if (authError && !notFound) {
        return { ok: false, error: `auth delete failed: ${authError.message}` }
      }
    }

    // 3. Scrub PII (keep the row + id + all links). Stamp anonymized last.
    const notes = await clearClientNotes(admin, clientId)
    if (!notes.ok) {
      return { ok: false, error: notes.message! }
    }
    // Communications' only PII is the recipient email — scrub it, keep the log
    // (kind/status/when), like the anonymized bookings it trails.
    const comms = await scrubCommunicationsForClient(admin, clientId)
    if (!comms.ok) {
      return { ok: false, error: comms.message! }
    }
    // Booking requests carry client free-text (`message`) = PII, and are
    // ephemeral (an accepted one's booking is retained anonymized) — delete them.
    const requests = await deleteBookingRequestsForClient(admin, clientId)
    if (!requests.ok) {
      return { ok: false, error: requests.message! }
    }
    // Design requests hold the client's own words and their reference photos.
    // Destroy the stored objects first, then the rows (messages + refs + offers
    // cascade from the request) — the reverse would orphan files in the bucket.
    const refs = await listDesignRefsForClient(admin, clientId)
    const purged = await purgeDesignRefsForClient(admin, clientId)
    // Deleting the requests cascades the ref ROWS away, so a file that survived
    // would be orphaned with nothing left to retry it. Stop instead of
    // reporting an erasure that didn't happen.
    if (purged < refs.length) {
      return { ok: false, error: "reference photo delete failed — retry" }
    }
    const design = await deleteDesignRequestsForClient(admin, clientId)
    if (!design.ok) {
      return { ok: false, error: design.message! }
    }
    // A testimonial is their name, their occupation and their words — and it may
    // be on the public home page, so it goes with them.
    const testimonials = await deleteTestimonialsForClient(admin, clientId)
    if (!testimonials.ok) {
      return { ok: false, error: testimonials.message! }
    }
    // Artist notes are about this client (may hold PII) — delete them on erasure.
    const notesGone = await deleteNotesForClient(admin, clientId)
    if (!notesGone.ok) {
      return { ok: false, error: "notes delete failed — retry" }
    }
    const scrubbed = await anonymizeClientRow(admin, clientId)
    if (!scrubbed.ok) {
      return { ok: false, error: scrubbed.message! }
    }

    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "erasure failed",
    }
  }
}

/** Owner erases a client on request (admin control). */
export async function anonymizeClient(
  clientId: string,
): Promise<AnonymizeResult> {
  const admin = await requireOwner()
  if (!admin) {
    return { ok: false, error: "unauthorized" }
  }
  const result = await runAnonymize(admin, clientId)
  if (result.ok) {
    revalidatePath(routes.admin.client(clientId))
    revalidatePath(routes.admin.clients)
    // The home page and /gallery are prerendered, so erased words and photos
    // would keep being SERVED from cached HTML after a "successful" erasure.
    revalidatePublicSurfaces()
  }

  return result
}

/** A signed-in client erases their own account (My space). */
export async function deleteMyAccount(): Promise<AnonymizeResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "not signed in" }
  }
  const result = await runAnonymize(createSupabaseServiceRoleClient(), user.id)
  // Same reason as above — this path revalidated nothing at all.
  if (result.ok) {
    revalidatePublicSurfaces()
  }

  return result
}
