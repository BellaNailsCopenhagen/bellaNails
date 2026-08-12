"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { saveTermsVersion } from "@/lib/actions/manage-terms"
import type { TermsKind, TermsRecord } from "@/lib/terms"
import { formatStudioDayMonthYear } from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const fieldLabel = "text-[10px] tracking-widest-lux"

/**
 * Owner editor for one terms document. Editing always publishes the NEXT
 * version (history is immutable so acceptance records keep their meaning); the
 * version history is shown read-only beneath.
 */
export function TermsEditor({
  kind,
  label,
  current,
  versions,
}: {
  kind: TermsKind
  label: string
  current: TermsRecord | null
  versions: TermsRecord[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [titleEn, setTitleEn] = useState(current?.titleEn ?? "")
  const [titleDk, setTitleDk] = useState(current?.titleDk ?? "")
  const [bodyEn, setBodyEn] = useState(current?.bodyEn ?? "")
  const [bodyDk, setBodyDk] = useState(current?.bodyDk ?? "")

  // Reseed from the current version each open so an abandoned draft (Close
  // without Publish) doesn't reappear next time.
  const openEditor = () => {
    setTitleEn(current?.titleEn ?? "")
    setTitleDk(current?.titleDk ?? "")
    setBodyEn(current?.bodyEn ?? "")
    setBodyDk(current?.bodyDk ?? "")
    setOpen(true)
  }

  const save = () =>
    startTransition(async () => {
      const result = await saveTermsVersion(kind, {
        titleEn,
        titleDk,
        bodyEn,
        bodyDk,
      })
      if (result.ok) {
        toast.success(`${label} published`)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(
          result.error === "unauthorized" ? "Not allowed." : result.error,
        )
      }
    })

  return (
    <section className="space-y-3 rounded-sm border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Eyebrow as="h3">{label}</Eyebrow>
          {current ? (
            <BodySm className="text-xs">
              {current.titleEn ?? "Untitled"} · v{current.version} ·{" "}
              {formatStudioDayMonthYear(
                new Date(current.createdAt).getTime(),
                ADMIN_LOCALE,
              )}
            </BodySm>
          ) : (
            <BodySm className="text-xs text-warning">
              No version yet — create the first.
            </BodySm>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openEditor}>
          {current ? "New version" : "Create"}
        </Button>
      </div>

      {versions.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <li key={v.id}>
              <Badge variant={v.isCurrent ? "success" : "outline"} size="xs">
                v{v.version}
                {v.isCurrent ? " · current" : ""}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>{current ? `New ${label} version` : label}</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor={`${kind}-title-en`} className={fieldLabel}>
                Title · EN
              </Label>
              <Input
                id={`${kind}-title-en`}
                value={titleEn}
                onValueChange={setTitleEn}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${kind}-title-da`} className={fieldLabel}>
                Title · DA
              </Label>
              <Input
                id={`${kind}-title-da`}
                value={titleDk}
                onValueChange={setTitleDk}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${kind}-body-en`} className={fieldLabel}>
              Body · EN
            </Label>
            <Textarea
              id={`${kind}-body-en`}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              className="min-h-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${kind}-body-da`} className={fieldLabel}>
              Body · DA
            </Label>
            <Textarea
              id={`${kind}-body-da`}
              value={bodyDk}
              onChange={(e) => setBodyDk(e.target.value)}
              className="min-h-48"
            />
          </div>

          <BodySm className="text-xs text-muted-foreground">
            Saving publishes a new current version. Separate paragraphs with a
            blank line.
          </BodySm>

          <div className="flex justify-end">
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? "Publishing…" : "Publish version"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
