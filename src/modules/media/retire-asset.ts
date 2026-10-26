import "server-only"

import { countUsagesForAsset } from "@/db/asset-usages"
import { deleteAsset, getAssetStorageKey } from "@/db/assets"
import type { Db } from "@/db/client"
import { countGalleryItemsUsingAsset } from "@/db/gallery-items"
import { countSectionsUsingAsset } from "@/db/service-sections"
import { deleteObject } from "@/platform/storage/supabase"

/**
 * Delete a published copy once nothing shows it any more.
 *
 * Three tables can hold an `asset_id`, and only one of them is `asset_usages`.
 * A service section points straight at the row with `on delete set null`, so
 * deleting on placement count alone silently blanks a service page; a gallery
 * item does the same to the home page. All three are asked here, in one place,
 * because every caller that removes the last thing showing a copy needs the same
 * answer and getting it wrong is invisible until a public page has a hole in it.
 *
 * Every step FAILS CLOSED. A count that errors, a file that will not delete, a
 * row that will not go — each keeps the copy. Deleting a photo a live page still
 * shows is unrecoverable; leaving one a moment too long is not.
 */
export async function retireAssetIfUnused(
  db: Db,
  assetId: string,
): Promise<{ deleted: boolean }> {
  let shownSomewhere: boolean
  try {
    const [placements, sections, galleryItems] = await Promise.all([
      countUsagesForAsset(db, assetId),
      countSectionsUsingAsset(db, assetId),
      countGalleryItemsUsingAsset(db, assetId),
    ])
    shownSomewhere = placements + sections + galleryItems > 0
  } catch (error) {
    // We could not establish that nothing shows it, which is not the same as
    // establishing that something does — but it is the only safe reading.
    console.error(
      `[asset] keeping ${assetId} — couldn't verify it is unused:`,
      error,
    )

    return { deleted: false }
  }
  if (shownSomewhere) {
    return { deleted: false }
  }

  // File first, row second: the row is the only thing that still points at the
  // object, so dropping it while the file survives leaves a public photo with
  // nothing left to retry the delete.
  const key = await getAssetStorageKey(db, assetId)
  if (key) {
    const gone = await deleteObject(key)
    if (!gone.ok) {
      console.error(
        `[asset] public file for ${assetId} kept — delete failed:`,
        gone.error,
      )

      return { deleted: false }
    }
  }

  // The file is gone; if the row will not follow it now points at nothing, and
  // the pickers that list it would offer a dead image.
  const removed = await deleteAsset(db, assetId)
  if (!removed.ok) {
    console.error(`[asset] row ${assetId} survived its deleted file — dead URL`)

    return { deleted: false }
  }

  return { deleted: true }
}
