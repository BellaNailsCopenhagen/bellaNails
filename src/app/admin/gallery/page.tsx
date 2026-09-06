import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ErrorState } from "@/components/ui/error-state"
import { StudioGalleryManager } from "@/app/admin/gallery/_components/studio-gallery-manager"
import { getStudioGalleryItems } from "@/modules/media/gallery-preview"

export const metadata: Metadata = { title: "Studio gallery" }
export const dynamic = "force-dynamic"

/**
 * The studio half of /gallery — the artist's own work.
 *
 * The public page has always shown two things: the studio's portfolio, then
 * consented client work. Only the client half had an admin (the asset hub);
 * `gallery_items` was written by the seed file and never again, so there was no
 * way to add a photo of her own. This is that way. Owner-gated by the proxy.
 */
export default async function AdminGalleryPage() {
  const { items, loadError } = await getStudioGalleryItems()

  return (
    <div className="space-y-6">
      <BackToMore />

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Studio gallery</H2>
        <BodySm className="text-xs">
          Your own work, on the gallery page and the home page. Client photos live
          in Client photos, where their permission is asked and kept.
        </BodySm>
      </div>

      {loadError ? (
        <ErrorState
          title="Couldn’t load the gallery"
          body="Nothing has changed — we just couldn’t read it right now. Try again in a moment rather than adding the images afresh."
        />
      ) : (
        <StudioGalleryManager items={items} />
      )}
    </div>
  )
}
