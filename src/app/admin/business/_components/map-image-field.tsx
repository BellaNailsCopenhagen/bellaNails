"use client"

import { toast } from "sonner"
import { ImagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmActionButton } from "@/components/ui/confirm-action-button"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { cardActionDestructive } from "@/components/admin/card-action"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  clearBusinessMapImage,
  setBusinessMapImage,
} from "@/modules/business/profile-actions"
import {
  DEFAULT_MAP_IMAGE,
  MAP_IMAGE_GUIDANCE,
} from "@/shared/business-profile"
import { PORTFOLIO_IMAGE } from "@/shared/media-policy"

/**
 * The picture shown on the home page under the address.
 *
 * An upload rather than a live map: an embedded map would send every visitor's
 * details to a mapping company, which this app avoids everywhere else. A
 * screenshot of the artist's own map view does the same job and discloses
 * nothing.
 *
 * The upload goes to the private area first (the only place an owner upload may
 * go) and the action publishes a copy into the public bucket.
 */
export function MapImageField({ currentUrl }: { currentUrl: string }) {
  const { pending, run } = useActionRunner()
  const { inputRef, uploading, pick, take } = usePhotoUpload({
    processFailed: "Couldn’t read that image — try another.",
    notConfigured: "Image storage isn’t set up yet.",
    rateLimited: "That’s a lot of uploads at once — wait a moment.",
    unsupported: "Use a JPG, PNG or WebP.",
    failed: "That upload didn’t work — try again.",
  })

  const isDefault = currentUrl === DEFAULT_MAP_IMAGE

  const onFile = async (files: FileList | null) => {
    const key = await take(files)
    if (!key) {
      return
    }
    run(async () => {
      const result = await setBusinessMapImage(key)
      if (result.ok) {
        toast.success("Map picture updated")
      }

      return result
    })
  }

  return (
    <section className="space-y-3">
      <Eyebrow as="h3">Map picture</Eyebrow>

      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        {/* The stored picture is an arbitrary bucket URL, so next/image would
            need the host in next.config — a plain img keeps this self-contained. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          // Every publish mints a fresh key, and clearing returns the shipped
          // illustration — so the URL itself changes on every transition and is
          // all the remount needs.
          key={currentUrl}
          src={currentUrl}
          alt=""
          className="aspect-[5/2] w-full object-cover"
        />
      </div>

      <BodySm className="text-xs text-muted-foreground">
        {isDefault
          ? "Showing the standard illustration — it isn’t a real map, so it’s worth replacing with a screenshot of your own map view."
          : "Your picture is showing on the home page."}
      </BodySm>

      <BodySm className="text-xs text-muted-foreground">
        Best at{" "}
        <strong>
          {MAP_IMAGE_GUIDANCE.width} × {MAP_IMAGE_GUIDANCE.height}
        </strong>{" "}
        ({MAP_IMAGE_GUIDANCE.ratio}) — a wide band, not a square. Anything wider
        is fine and gets scaled down to {PORTFOLIO_IMAGE.maxDim}px; anything
        much taller will be cropped top and bottom. JPG, PNG or WebP.
      </BodySm>

      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => onFile(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading || pending}
          onClick={pick}
        >
          <ImagePlus className="size-3.5" />
          {uploading || pending
            ? "Uploading…"
            : isDefault
              ? "Upload a picture"
              : "Replace picture"}
        </Button>

        {isDefault ? null : (
          <ConfirmActionButton
            action={clearBusinessMapImage}
            trigger={
              <button type="button" className={cardActionDestructive()}>
                Remove
              </button>
            }
            labels={{
              title: "Remove the map picture?",
              body: "The home page goes back to the standard illustration. Your address and the link out to maps are unaffected.",
              confirm: "Remove",
              confirming: "Removing…",
              cancel: "Keep it",
              failed: "Couldn’t remove it.",
            }}
          />
        )}
      </div>
    </section>
  )
}
