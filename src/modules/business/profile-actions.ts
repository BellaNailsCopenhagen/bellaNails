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
  if (!saved.ok) {
    // The reason, or this is unsolvable from the outside: every field goes in one
    // upsert, so a single column the database is missing fails the whole form —
    // and "Couldn't save that" on an address change tells nobody that.
    console.error("[business] profile save failed:", saved.message)
    return { ok: false, error: "Couldn’t save that." }
  }

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
 * Publish a freshly uploaded object and hang one profile column off it.
 *
 * The browser uploads to the PRIVATE area — that is the only place an owner
 * upload may go — so this publishes a copy into the public bucket and stores
 * that key.
 *
 * EVERY exit deletes whatever it made or replaced. Nothing sweeps the private
 * or public buckets (only `refs` has an orphan sweep), so an object dropped on
 * a failure path stays there for good — and a stranded PUBLIC copy stays
 * readable by anyone who saw its URL.
 *
 * The map picture and the hero background do the identical dance, and getting
 * one of its four exits wrong is invisible until the bucket is full of things
 * nobody can reach — so they do it once, here.
 */
async function swapProfileAsset(
  column: "map_image_key" | "hero_asset_key",
  privateKey: string,
  failure: string,
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
  const previous = await previousKey(db, column)

  const published = await publishToPublic(privateKey)
  if (!published.ok) {
    // The staging upload is ours and now useless.
    await cleanUp([privateKey])
    return { ok: false, error: failure }
  }

  const saved = await upsertBusinessProfile(db, { [column]: published.data.key })
  if (!saved.ok) {
    // The row still points at the old one, so the copy just published is an
    // orphan — and a publicly readable one. Take both staging objects with it.
    await cleanUp([published.data.key, privateKey])
    return { ok: false, error: failure }
  }

  // The row is safely on the new copy: the staging original and the one it
  // replaced are both dead now.
  await cleanUp([privateKey, previous])

  revalidateProfile()
  return { ok: true }
}

/** Drop the asset and fall back to whatever ships with the app. */
async function clearProfileAsset(
  column: "map_image_key" | "hero_asset_key",
): Promise<ProfileResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const previous = await previousKey(db, column)
  const saved = await upsertBusinessProfile(db, { [column]: null })
  if (!saved.ok) return { ok: false, error: "Couldn’t remove it." }

  await cleanUp([previous])
  revalidateProfile()
  return { ok: true }
}

/** Set the map picture from a freshly uploaded object. */
export async function setBusinessMapImage(
  privateKey: string,
): Promise<ProfileResult> {
  return swapProfileAsset("map_image_key", privateKey, "Couldn’t save the picture.")
}

/** Remove the uploaded picture and fall back to the shipped illustration. */
export async function clearBusinessMapImage(): Promise<ProfileResult> {
  return clearProfileAsset("map_image_key")
}

/**
 * Set the hero background — the photo or film behind the landing statement.
 *
 * Size is NOT re-checked here. The cap on a film is about what the site costs to
 * serve, not about what is safe to store, and the bucket's own limit is the
 * backstop that matters — so the admin enforces the budget and this enforces the
 * boundary (owner, own upload area).
 */
export async function setHeroBackground(
  privateKey: string,
): Promise<ProfileResult> {
  return swapProfileAsset("hero_asset_key", privateKey, "Couldn’t save the background.")
}

/** Remove it and fall back to the photo shipped with the app. */
export async function clearHeroBackground(): Promise<ProfileResult> {
  return clearProfileAsset("hero_asset_key")
}

/**
 * The key the row currently holds for a column, or null.
 *
 * A read failure returns null — clearing or replacing must still work — but it
 * is LOUD, because null here is indistinguishable from "there was nothing" and
 * the difference is an object nobody will ever collect.
 */
async function previousKey(
  db: Db,
  column: "map_image_key" | "hero_asset_key",
): Promise<string | null> {
  try {
    return (await getBusinessProfileRow(db))?.[column] ?? null
  } catch (error) {
    console.error(
      `[business] couldn't read the current ${column} — the object it points at will be stranded:`,
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
      console.error("[business] orphaned profile object", key, removed.error)
    }
  }
}

/** The Business page shows these; the public shell renders them everywhere. */
function revalidateProfile(): void {
  revalidatePath(routes.admin.business)
  revalidatePublicShell()
}
