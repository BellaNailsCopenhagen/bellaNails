"use server"

import { revalidatePath } from "next/cache"

import { getBusinessProfileRow, upsertBusinessProfile } from "@/db/business-profile"
import type { Db } from "@/db/client"
import { requireOwner } from "@/modules/identity/require-owner"
import { deleteObject, publishToPublic } from "@/platform/storage/supabase"
import { revalidatePublicShell } from "@/modules/revalidate"
import { EMAIL_PATTERN } from "@/shared/contact-validation"
import {
  normalizeSocialUrl,
  type BusinessProfileInput,
} from "@/shared/business-profile"
import { routes } from "@/shared/routes"

export type ProfileResult = { ok: true } | { ok: false; error: string }

/**
 * The business's own details. Owner-only, and every value is re-validated here —
 * two of these become an email envelope and three become links on a public
 * page, so the form is convenience, not the boundary.
 */
export async function saveBusinessProfile(
  input: BusinessProfileInput,
): Promise<
  /** `saved` is what was STORED — a handle comes back as a full URL, so the
      form can show her what it actually did rather than what she typed. */
  | { ok: true; note: string; saved: BusinessProfileInput }
  | { ok: false; error: string }
> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  // Empty clears the field, which means "fall back to the built-in address" —
  // so only a NON-empty value has to look like an address.
  const contactEmail = input.contactEmail.trim().toLowerCase()
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    return { ok: false, error: "That contact address doesn't look right." }
  }
  const bookingFromEmail = input.bookingFromEmail.trim().toLowerCase()
  if (bookingFromEmail && !EMAIL_PATTERN.test(bookingFromEmail)) {
    return { ok: false, error: "That sending address doesn't look right." }
  }
  const alertEmail = input.alertEmail.trim().toLowerCase()
  if (alertEmail && !EMAIL_PATTERN.test(alertEmail)) {
    return { ok: false, error: "That alert address doesn't look right." }
  }

  const stored = {
    contact_email: contactEmail || null,
    booking_from_email: bookingFromEmail || null,
    alert_email: alertEmail || null,
    address_line_1: input.addressLine1.trim() || null,
    address_line_2: input.addressLine2.trim() || null,
    instagram_url: normalizeSocialUrl("instagramUrl", input.instagramUrl),
    facebook_url: normalizeSocialUrl("facebookUrl", input.facebookUrl),
    tiktok_url: normalizeSocialUrl("tiktokUrl", input.tiktokUrl),
  }
  const saved = await upsertBusinessProfile(db, stored)
  if (!saved.ok) return { ok: false, error: "Couldn’t save that." }

  revalidatePath(routes.admin.business)
  // The footer is in the public layout, so this is the whole prerendered site —
  // /services and the rest carry the address too, not just the home page.
  revalidatePublicShell()
  return {
    ok: true,
    // `note` is what makes useActionRunner toast — without it a save that
    // lowercases addresses and expands handles under the cursor said nothing.
    note: "Saved",
    saved: {
      contactEmail: stored.contact_email ?? "",
      bookingFromEmail: stored.booking_from_email ?? "",
      alertEmail: stored.alert_email ?? "",
      addressLine1: stored.address_line_1 ?? "",
      addressLine2: stored.address_line_2 ?? "",
      instagramUrl: stored.instagram_url ?? "",
      facebookUrl: stored.facebook_url ?? "",
      tiktokUrl: stored.tiktok_url ?? "",
    },
  }
}

/** Owner uploads land here first (see /api/media/sign). */
const PRIVATE_PREFIX = "private/"

/**
 * Set the map picture from a freshly uploaded object.
 *
 * The browser uploads to the PRIVATE area — that is the only place an owner
 * upload may go — so this publishes a copy into the public bucket and stores
 * that key.
 *
 * EVERY exit deletes whatever it made or replaced. Nothing sweeps the private
 * or public buckets (only `refs` has an orphan sweep), so an object dropped on
 * a failure path stays there for good — and a stranded PUBLIC copy stays
 * readable by anyone who saw its URL.
 */
export async function setBusinessMapImage(
  privateKey: string,
): Promise<ProfileResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }
  // Confines this to the owner's own upload area — a crafted key must not be
  // able to nominate an arbitrary object for publication.
  if (!privateKey.startsWith(PRIVATE_PREFIX)) {
    return { ok: false, error: "Couldn’t use that upload." }
  }

  // Read the outgoing key BEFORE anything replaces it. A failure here must not
  // pass silently: it is how an old public copy gets stranded.
  const previous = await previousMapKey(db)

  const published = await publishToPublic(privateKey)
  if (!published.ok) {
    // The staging upload is ours and now useless.
    await cleanUp([privateKey])
    return { ok: false, error: "Couldn’t save the picture." }
  }

  const saved = await upsertBusinessProfile(db, {
    map_image_key: published.data.key,
  })
  if (!saved.ok) {
    // The row still points at the old picture, so the copy just published is an
    // orphan — and a publicly readable one. Take both staging objects with it.
    await cleanUp([published.data.key, privateKey])
    return { ok: false, error: "Couldn’t save the picture." }
  }

  // The row is safely on the new copy: the staging original and the one it
  // replaced are both dead now.
  await cleanUp([privateKey, previous])

  revalidateProfile()
  return { ok: true }
}

/** Remove the uploaded picture and fall back to the shipped illustration. */
export async function clearBusinessMapImage(): Promise<ProfileResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const previous = await previousMapKey(db)
  const saved = await upsertBusinessProfile(db, { map_image_key: null })
  if (!saved.ok) return { ok: false, error: "Couldn’t remove it." }

  await cleanUp([previous])
  revalidateProfile()
  return { ok: true }
}

/**
 * The map key the row currently holds, or null.
 *
 * A read failure returns null — clearing or replacing the picture must still
 * work — but it is LOUD, because null here is indistinguishable from "there
 * was no picture" and the difference is an object nobody will ever collect.
 */
async function previousMapKey(db: Db): Promise<string | null> {
  try {
    return (await getBusinessProfileRow(db))?.map_image_key ?? null
  } catch (error) {
    console.error(
      "[business] couldn't read the current map key — the object it points at will be stranded:",
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

/** Objects nothing references any more. A failure costs storage, not
    correctness, so it is logged rather than surfaced — but it IS logged: these
    buckets have no sweep, so this is the only record. */
async function cleanUp(keys: (string | null | undefined)[]): Promise<void> {
  for (const key of keys) {
    if (!key) continue
    const removed = await deleteObject(key)
    if (!removed.ok) {
      console.error("[business] orphaned map object", key, removed.error)
    }
  }
}

/** The Business page shows these; the public shell renders them everywhere. */
function revalidateProfile(): void {
  revalidatePath(routes.admin.business)
  revalidatePublicShell()
}
