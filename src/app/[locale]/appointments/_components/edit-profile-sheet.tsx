"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useActionRunner } from "@/hooks/use-action-runner"
import { updateMyProfile } from "@/modules/clients/actions"

const labelText =
  "font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"

/**
 * Edit your own name + phone, behind a sheet. The fields used to sit open on the
 * settings panel with a Save button stranded between sections, so the one thing
 * that page is for read as decoration — a button that saves nothing until you
 * type is not a call to action.
 */
export function EditProfileSheet({
  name,
  phone,
}: {
  name: string | null
  phone: string | null
}) {
  const t = useTranslations("account")
  const [open, setOpen] = useState(false)
  const [nameValue, setName] = useState(name ?? "")
  const [phoneValue, setPhone] = useState(phone ?? "")
  const { pending, run } = useActionRunner(t("saveFailed"))

  // Reopening after a cancel must not show what was abandoned.
  const openSheet = () => {
    setName(name ?? "")
    setPhone(phone ?? "")
    setOpen(true)
  }

  const save = () =>
    run(async () => {
      const result = await updateMyProfile({
        name: nameValue,
        phone: phoneValue,
      })
      if (result.ok) setOpen(false)
      return result.ok ? { ...result, note: t("saved") } : result
    })

  return (
    <>
      <Button variant="outline" size="sm" onClick={openSheet}>
        {t("edit")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-6">
          <SheetTitle>{t("editTitle")}</SheetTitle>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="profile-name" className={labelText}>
                {t("name")}
              </Label>
              <Input
                id="profile-name"
                value={nameValue}
                onValueChange={setName}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-phone" className={labelText}>
                {t("phone")}
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phoneValue}
                onValueChange={setPhone}
                placeholder={t("phonePlaceholder")}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
