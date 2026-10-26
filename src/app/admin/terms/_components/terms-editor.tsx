"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { saveTermsVersion } from "@/modules/terms/actions"
import type { TermsKind, TermsRecord } from "@/modules/terms/terms"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"
import { FieldLabel, RequiredLegend } from "@/components/admin/field-label"
import { termsProblem } from "@/shared/terms-validation"

/**
 * Owner editor for one terms document. Editing always publishes the NEXT
 * version (history is immutable so acceptance records keep their meaning); the
 * version history is shown beneath and any past version can be read.
 *
 * Publish is disabled until the document is complete in both languages, on the
 * same rule the action refuses with — publishing makes it current immediately,
 * and there is no rollback.
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
  const [reading, setReading] = useState<TermsRecord | null>(null)
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

  // The same function the action refuses with, so the button and the server can
  // never disagree about what "complete" means.
  const problem = termsProblem({ titleEn, titleDk, bodyEn, bodyDk })

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
              {/* An immutable history nobody can read is not a history. */}
              <button
                type="button"
                onClick={() => setReading(v)}
                title={`Read v${v.version}`}
                className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Badge variant={v.isCurrent ? "success" : "outline"} size="xs">
                  v{v.version}
                  {v.isCurrent ? " · current" : ""}
                </Badge>
              </button>
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
              <FieldLabel htmlFor={`${kind}-title-en`} required>
                Title · EN
              </FieldLabel>
              <Input
                id={`${kind}-title-en`}
                aria-required="true"
                value={titleEn}
                onValueChange={setTitleEn}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor={`${kind}-title-da`} required>
                Title · DA
              </FieldLabel>
              <Input
                id={`${kind}-title-da`}
                aria-required="true"
                value={titleDk}
                onValueChange={setTitleDk}
              />
            </div>
          </div>

          <div className="space-y-1">
            <FieldLabel htmlFor={`${kind}-body-en`} required>
              Body · EN
            </FieldLabel>
            <Textarea
              id={`${kind}-body-en`}
              aria-required="true"
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              className="min-h-48"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor={`${kind}-body-da`} required>
              Body · DA
            </FieldLabel>
            <Textarea
              id={`${kind}-body-da`}
              aria-required="true"
              value={bodyDk}
              onChange={(e) => setBodyDk(e.target.value)}
              className="min-h-48"
            />
          </div>

          <BodySm className="text-xs text-muted-foreground">
            Saving publishes a new current version, live on the public page at
            once. Separate paragraphs with a blank line.
          </BodySm>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <RequiredLegend className="mr-auto" />
            {problem ? (
              <BodySm className="text-xs text-destructive">
                {problem.message}
              </BodySm>
            ) : null}
            <Button
              size="sm"
              disabled={pending || problem !== null}
              onClick={save}
            >
              {pending ? "Publishing…" : "Publish version"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Read-only: a past version is what somebody agreed to, so it cannot be
          edited here. Publishing a correction means a new version. */}
      <Sheet
        open={reading !== null}
        onOpenChange={(o) => !o && setReading(null)}
      >
        <SheetContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle>
              {label} · v{reading?.version}
              {reading?.isCurrent ? " · current" : ""}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setReading(null)}
              className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
          </div>

          {reading ? (
            <>
              <BodySm className="text-xs text-muted-foreground">
                Published{" "}
                {formatStudioDayMonthYear(
                  new Date(reading.createdAt).getTime(),
                  ADMIN_LOCALE,
                )}
                . Read-only — publish a new version to change anything.
              </BodySm>
              {(
                [
                  ["Title · EN", reading.titleEn],
                  ["Title · DA", reading.titleDk],
                  ["Body · EN", reading.bodyEn],
                  ["Body · DA", reading.bodyDk],
                ] as const
              ).map(([heading, value]) => (
                <div key={heading} className="space-y-1">
                  <Eyebrow as="h4">{heading}</Eyebrow>
                  <BodySm className="text-xs whitespace-pre-wrap">
                    {value?.trim() || "— empty —"}
                  </BodySm>
                </div>
              ))}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
