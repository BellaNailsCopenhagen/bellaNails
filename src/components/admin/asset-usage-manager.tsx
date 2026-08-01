"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  addAssetUsage,
  removeAssetUsage,
} from "@/lib/actions/manage-asset-usages"
import type { AssetUsage } from "@/lib/admin/assets"

const LABELS: Record<string, string> = {
  clients_gallery: "Clients gallery",
  showcase: "Showcase",
  testimonial: "Testimonial",
  some: "Social",
}
// Website surfaces need SITE consent; social needs SoMe consent.
const WEBSITE = ["clients_gallery", "showcase", "testimonial"]
const SOCIAL = ["some"]

/**
 * Assign a shared asset to use-cases. Only surfaces the consent covers are
 * offered (site → website surfaces, some → social), so placement can't outrun
 * what the client approved. Social placement takes an optional post link.
 */
export function AssetUsageManager({
  assetId,
  purpose,
  usages,
}: {
  assetId: string
  purpose: string
  usages: AssetUsage[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const surfaces = purpose === "some" ? SOCIAL : WEBSITE
  const usageBySurface = new Map(usages.map((u) => [u.surface, u]))

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.ok) router.refresh()
      else toast.error(result.error || "Something went wrong.")
    })

  const toggle = (surface: string) => {
    const existing = usageBySurface.get(surface)
    if (existing) run(() => removeAssetUsage(existing.id))
    else run(() => addAssetUsage(assetId, surface))
  }

  const someUsage = usageBySurface.get("some")

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {surfaces.map((surface) => {
          const active = usageBySurface.has(surface)
          return (
            <button
              key={surface}
              type="button"
              disabled={pending}
              onClick={() => toggle(surface)}
              className={cn(
                "rounded-full border px-3 py-1 font-functional text-xs transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LABELS[surface]}
            </button>
          )
        })}
      </div>

      {someUsage ? (
        <SocialLink
          initialUrl={someUsage.url ?? ""}
          pending={pending}
          onSave={(url) => run(() => addAssetUsage(assetId, "some", url))}
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
