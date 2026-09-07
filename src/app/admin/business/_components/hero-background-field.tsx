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
  clearHeroBackground,
  setHeroBackground,
} from "@/modules/business/profile-actions"
import {
  DEFAULT_HERO_IMAGE,
  HERO_GUIDANCE,
  type HeroBackground,
} from "@/shared/business-profile"
import { PORTFOLIO_IMAGE, VIDEO } from "@/shared/media-policy"
import { videoOptimizeSupported } from "@/shared/video-optimize"

const asMb = (bytes: number) => Math.round(bytes / 1024 / 1024)
/** One decimal, so "that film is 8 MB, keep it under 8 MB" can't happen. */
const asExactMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

/**
 * The picture — or the film — behind the landing statement.
 *
 * A film is the only asset here served to every single visitor of the home page,
 * so its size is a running cost rather than a one-off. Which is why it is
 * re-encoded on the way out, the same as a photo: 1280px at 1.2 Mbps turns a
 * phone's 40 MB clip into two or three. The re-encode runs in real time, so it
 * reports a percentage rather than spinning.
 *
 * The byte cap is only consulted when this browser CANNOT re-encode. Applying it
 * to the original file otherwise would reject a 40 MB clip that was about to
 * become 2 MB.
 */
export function HeroBackgroundField({ current }: { current: HeroBackground }) {
  const { pending, run } = useActionRunner()
  const { inputRef, uploading, progress, pick, take } = usePhotoUpload(
    {
      processFailed: "Couldn’t read that image — try another.",
      notConfigured: "Media storage isn’t set up yet.",
      rateLimited: "That’s a lot of uploads at once — wait a moment.",
      unsupported: "Use a JPG, PNG, WebP, MP4 or WebM.",
      tooLong: `That film is longer than ${VIDEO.maxSeconds} seconds — trim it and try again.`,
      tooLarge: `That film is still over ${asMb(VIDEO.maxBytes)} MB after shrinking — a shorter or calmer clip will compress further.`,
      failed: "That upload didn’t work — try again.",
    },
    VIDEO,
  )

  const isDefault = current.url === DEFAULT_HERO_IMAGE

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    // Only when nothing is going to shrink it. Checked here and not in the
    // action so she finds out before the upload rather than after it.
    if (
      file?.type.startsWith("video/") &&
      !videoOptimizeSupported() &&
      file.size > VIDEO.maxBytes
    ) {
      toast.error(
        `That film is ${asExactMb(file.size)} MB and this browser can’t shrink it — keep it under ${asMb(VIDEO.maxBytes)} MB, or the home page gets slow for everyone.`,
      )
      // `take()` normally clears this on its way out. Returning before it means
      // doing so here, or picking the same path again fires no change event and
      // the button looks dead.
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const key = await take(files)
    if (!key) return
    run(async () => {
      const result = await setHeroBackground(key)
      if (result.ok) toast.success("Hero background updated")
      return result
    })
  }

  return (
    <section className="space-y-3">
      <Eyebrow as="h3">Hero background</Eyebrow>

      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        {/* An arbitrary bucket URL, so next/image would need the host in
            next.config — a plain element keeps this self-contained. The URL
            changes on every publish, so it is all the remount needs. */}
        {current.kind === "video" ? (
          <video
            key={current.url}
            src={current.url}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={current.url}
            src={current.url}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        )}
      </div>

      <BodySm className="text-xs text-muted-foreground">
        {isDefault
          ? "Showing the photo that ships with the site — replace it with your own."
          : current.kind === "video"
            ? "Your film is playing behind the home page. It is muted, and a visitor can stop it — anyone who has asked their device for less movement gets a still frame instead."
            : "Your picture is showing behind the home page."}
      </BodySm>

      <BodySm className="text-xs text-muted-foreground">
        It fills the whole first screen and is cropped hard on a phone, so keep
        the subject away from the edges. A picture is best around{" "}
        <strong>
          {HERO_GUIDANCE.width} × {HERO_GUIDANCE.height}
        </strong>{" "}
        and is scaled down to {PORTFOLIO_IMAGE.maxDim}px. A film should be short —
        about {HERO_GUIDANCE.seconds} seconds, and no longer than{" "}
        {VIDEO.maxSeconds}. It is shrunk to {VIDEO.maxDim}px and re-encoded here
        in your browser, which takes about as long as the film itself, so upload
        it straight off the camera and let it do the work. It has no sound: the
        background is always muted. JPG, PNG, WebP, MP4 or WebM.
      </BodySm>

      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
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
          {progress !== null
            ? `Shrinking the film… ${Math.round(progress * 100)}%`
            : uploading || pending
              ? "Uploading…"
              : isDefault
                ? "Upload a background"
                : "Replace background"}
        </Button>

        {isDefault ? null : (
          <ConfirmActionButton
            action={clearHeroBackground}
            trigger={
              <button type="button" className={cardActionDestructive()}>
                Remove
              </button>
            }
            labels={{
              title: "Remove the hero background?",
              body: "The home page goes back to the photo that ships with the site. Your headline and the Reserve button are unaffected.",
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
