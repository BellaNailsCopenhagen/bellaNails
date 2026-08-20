"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DeleteOwnMediaButton } from "@/app/[locale]/appointments/_components/delete-own-media-button"
import { withdrawPill } from "@/components/ui/confirm-action-button"
import { withdrawMediaConsent } from "@/modules/media/consent-actions"
import { useActionRunner } from "@/hooks/use-action-runner"
import type { ClientMediaItem, MediaPurpose } from "@/modules/media/client-gallery"

// Quiet inline text link — the "hidden but available" entry to removal.
const inlineLink =
  "font-functional underline decoration-dotted underline-offset-2 transition-colors hover:text-destructive"

/**
 * The plain-language line describing where a photo is shared. The state is told
 * as a sentence ("You've shared this photo…") rather than status badges, and
 * removal hides behind an inline link — it's a rare, considered action, so it
 * stays available without shouting.
 */
function ShareSentence({
  item,
  onManage,
}: {
  item: ClientMediaItem
  onManage: () => void
}) {
  const t = useTranslations("bookings")
  const site = item.site === "granted"
  const some = item.some === "granted"

  if (!site && !some) {
    return (
      <p className="font-functional text-sm leading-relaxed text-muted-foreground">
        {t("shareStatePrivate")}
      </p>
    )
  }

  const key = site && some ? "shareStateBoth" : site ? "shareStateWebsite" : "shareStateSocial"
  return (
    <p className="font-functional text-sm leading-relaxed text-muted-foreground">
      {t.rich(key, {
        link: (chunks) => (
          <button type="button" onClick={onManage} className={inlineLink}>
            {chunks}
          </button>
        ),
      })}
    </p>
  )
}

/**
 * Warm "manage what's shared" dialog reached from the inline link. Lists each
 * live permission with what removal means (website is instant; social is taken
 * down by hand) and lets the client withdraw it right there. Stays open once
 * the last permission is gone, confirming the photo is private again — so focus
 * never lands on a removed trigger.
 *
 * Nested inside the Sheet's tree so Base UI treats it as a child dialog: a press
 * on this dialog's backdrop won't dismiss the Sheet underneath it.
 */
function ManageShareDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ClientMediaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("bookings")
  const { pending, run } = useActionRunner(t("loadError"))

  const granted = (["site", "some"] as MediaPurpose[]).filter(
    (p) => item[p] === "granted",
  )

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{t("withdrawManageTitle")}</AlertDialogTitle>
        <AlertDialogDescription>{t("withdrawManageBody")}</AlertDialogDescription>

        {granted.length ? (
          <div className="mt-6 space-y-4">
            {granted.map((purpose) => (
              <div
                key={purpose}
                className="space-y-1.5 border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                <p className="font-functional text-sm text-foreground">
                  {purpose === "site" ? t("shareWebsite") : t("shareSocial")}
                </p>
                <p className="font-functional text-xs text-muted-foreground">
                  {purpose === "site"
                    ? t("withdrawSiteNote")
                    : t("withdrawSomeNote")}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => withdrawMediaConsent(item.id, purpose))}
                >
                  {purpose === "site"
                    ? t("removeFromWebsite")
                    : t("removeFromSocial")}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 font-functional text-sm text-success">
            {t("withdrawDoneNote")}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            {granted.length ? t("withdrawKeepCta") : t("closeCta")}
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * One photo in the client's Gallery: a clean masonry thumbnail (real aspect
 * ratio) that opens a full-size dialog. The share overview and the removal +
 * delete actions live in that dialog — so the grid stays a gallery and the
 * details are only a tap away.
 */
export function ClientGalleryTile({ item }: { item: ClientMediaItem }) {
  const t = useTranslations("bookings")
  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  return (
    <li className="mb-4 break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={item.caption ?? t("viewPhoto")}
        className="block w-full overflow-hidden rounded-sm border border-border transition-opacity hover:opacity-90"
      >
        {item.kind === "video" ? (
          <video src={item.url} preload="metadata" className="w-full" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.url} alt="" className="w-full" />
        )}
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setManageOpen(false) // don't reopen the manage dialog next time
        }}
      >
        <SheetContent className="space-y-5">
          <SheetTitle>{t("photoTitle")}</SheetTitle>

          {item.kind === "video" ? (
            <video
              src={item.url}
              controls
              className="max-h-[60vh] w-full rounded-sm border border-border object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt={item.caption ?? ""}
              className="max-h-[60vh] w-full rounded-sm border border-border object-contain"
            />
          )}

          <div className="border-t border-border pt-4">
            <ShareSentence item={item} onManage={() => setManageOpen(true)} />
          </div>

          {item.source === "client" ? (
            <div className="border-t border-border pt-4">
              <DeleteOwnMediaButton
                mediaId={item.id}
                labels={{
                  title: t("deleteTitle"),
                  body: t("deleteBody"),
                  confirm: t("deleteConfirm"),
                  confirming: t("deleteConfirming"),
                  cancel: t("deleteCancel"),
                  failed: t("loadError"),
                }}
                trigger={
                  <button type="button" className={withdrawPill}>
                    {t("deletePhotoCta")}
                  </button>
                }
              />
            </div>
          ) : null}

          {/* Nested in the Sheet's tree so its backdrop can't dismiss the Sheet. */}
          <ManageShareDialog
            item={item}
            open={manageOpen}
            onOpenChange={setManageOpen}
          />
        </SheetContent>
      </Sheet>
    </li>
  )
}
