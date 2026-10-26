import { ShieldAlert } from "lucide-react"

import { BodySm } from "@/components/ui/typography"

/**
 * The one thing the artist has to understand about this page: these images are
 * outside the consent system entirely.
 *
 * Every other picture on the site is tied to a client, a booking and a release,
 * so a withdrawal can find it and take it down. A studio image has none of that
 * — no owner on record, no permission, nothing to trace. Which means the legal
 * exposure is hers, and the app cannot help her carry it. Saying so plainly, in
 * the place where she uploads, is the only protection there is.
 */
export function GalleryOwnershipNotice() {
  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-4">
      <p className="flex items-center gap-2 font-functional text-[0.625rem] uppercase tracking-widest-lux text-warning">
        <ShieldAlert className="size-3.5" />
        These images are yours to stand behind
      </p>
      <BodySm className="max-w-prose text-xs text-muted-foreground">
        Nothing here is covered by the permission flow the rest of the site
        uses. There is no client, no appointment and no consent recorded against
        these pictures — so if one is ever questioned, the answer rests on you,
        not on anything the app can show.
      </BodySm>
      <ul className="ml-4 list-disc space-y-1 font-functional text-xs text-muted-foreground">
        <li>
          Use only work you photographed yourself, or images you hold the rights
          to. A picture found online is not yours to publish.
        </li>
        <li>
          If a person can be recognised — a face, a tattoo, a piece of jewellery
          — you need their permission, and this page does not record it.
        </li>
        <li>
          <strong className="font-medium text-foreground">
            A client’s photo never belongs here.
          </strong>{" "}
          Use Client photos, where permission is asked per appointment and a
          withdrawal takes the picture down by itself.
        </li>
        <li>
          You can remove any of these at any time — it comes off the gallery and
          the home page immediately, and the file is deleted.
        </li>
      </ul>
    </div>
  )
}
