"use client"

import { useState } from "react"
import { ArrowUpRight } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/cn"
import { useActionRunner } from "@/hooks/use-action-runner"
import { placeMedia } from "@/modules/media/asset-actions"
import {
  removeAssetUsage,
  setPlacementLink,
} from "@/modules/media/usage-actions"
import { SURFACE_LABELS, surfacesForPurpose } from "@/shared/asset-surfaces"
import type { HubPublished } from "@/modules/media/asset-hub"

/**
 * Where a photo is used, for one consent purpose. Only surfaces that consent
 * covers are offered (website → site surfaces, social → SoMe), and the server
 * re-checks it — placement can never outrun what the client approved.
 *
 * Choosing a surface is what publishes the public copy — there is no separate
 * publish step to forget, and so no copy is ever made that the artist did not
 * ask to place. Clearing a surface only removes the placement: the same copy can
 * be a service-section image or a gallery item, and consent withdrawal is what
 * deletes it.
 */
export function AssetUsageManager({
  mediaId,
  purpose,
  published,
}: {
  mediaId: string
  purpose: "website" | "social"
  /** The public copy, once one exists. Absent until the first placement. */
  published: HubPublished | undefined
}) {
  const { pending, run } = useActionRunner()
  const usageBySurface = new Map(
    (published?.usages ?? []).map((u) => [u.surface, u]),
  )
  // Offer the surfaces consent covers, PLUS any this copy already sits on. A
  // surface can be retired from the product (`testimonial` was) while rows still
  // point at it — and a placement with no toggle can never be removed, so the
  // photo reads as in use for good while rendering nowhere.
  const surfaces = [
    ...surfacesForPurpose(purpose),
    ...[...usageBySurface.keys()].filter(
      (surface) => !surfacesForPurpose(purpose).includes(surface as never),
    ),
  ]

  const toggle = (surface: string) => {
    const existing = usageBySurface.get(surface)
    if (existing) run(() => removeAssetUsage(existing.id))
    else run(() => placeMedia(mediaId, purpose, surface))
  }

  const someUsage = usageBySurface.get("some")

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {surfaces.map((surface) => {
          const active = usageBySurface.has(surface)
          // A retired surface can only be turned OFF — never back on.
          const retired = !surfacesForPurpose(purpose).includes(surface as never)
          return (
            <button
              key={surface}
              type="button"
              disabled={pending || (retired && !active)}
              title={retired ? "No longer offered — remove it" : undefined}
              onClick={() => toggle(surface)}
              className={cn(
                "rounded-full border px-3 py-1 font-functional text-xs transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {SURFACE_LABELS[surface as keyof typeof SURFACE_LABELS] ?? surface}
            </button>
          )
        })}
      </div>

      {someUsage && published ? (
        <SocialLink
          initialUrl={someUsage.url ?? ""}
          pending={pending}
          onSave={(url) => run(() => setPlacementLink(published.assetId, url))}
        />
      ) : null}
    </div>
  )
}

function SocialLink({
  initialUrl,
  pending,
  onSave,
}: {
  initialUrl: string
  pending: boolean
  onSave: (url: string) => void
}) {
  const [url, setUrl] = useState(initialUrl)

  return (
    <div className="flex items-center gap-2">
      <Input
        value={url}
        onValueChange={setUrl}
        placeholder="Link to the post (optional)"
        className="text-sm"
      />
      {initialUrl ? (
        <a
          href={initialUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open post"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </a>
      ) : null}
      {url !== initialUrl ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onSave(url)}
        >
          Save
        </Button>
      ) : null}
    </div>
  )
}
