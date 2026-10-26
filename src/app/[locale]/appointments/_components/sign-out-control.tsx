"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { LogOut } from "lucide-react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { signOut } from "@/modules/identity/actions"

/**
 * Sign out, from the top of My Space rather than buried in the settings tab.
 * Confirmed first: on a shared or family device the tap next to it is the one
 * that opens the page, and signing out by accident costs a whole login.
 *
 * Not the shared `SignOutButton` — that one is locale-free for the admin shell,
 * which has no next-intl provider, and it leaves without asking.
 */
export function SignOutControl() {
  const t = useTranslations("account")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      await signOut()
      window.location.assign("/")
    })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next)
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            {t("signOut")}
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogTitle>{t("signOutTitle")}</AlertDialogTitle>
        <AlertDialogDescription>{t("signOutBody")}</AlertDialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            {t("signOutCancel")}
          </AlertDialogClose>
          <Button size="sm" disabled={pending} onClick={confirm}>
            {pending ? t("signingOut") : t("signOutConfirm")}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
