"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useActionRunner } from "@/lib/hooks/use-action-runner"
import { updateMyProfile } from "@/lib/actions/update-profile"

const labelText =
  "block font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"

/** Edit your own name + phone. */
export function ProfileForm({
  name,
  phone,
}: {
  name: string | null
  phone: string | null
}) {
  const [nameValue, setName] = useState(name ?? "")
  const [phoneValue, setPhone] = useState(phone ?? "")
  const { pending, run } = useActionRunner()

  const save = () =>
    run(async () => {
      const result = await updateMyProfile({ name: nameValue, phone: phoneValue })
      return result.ok ? { ...result, note: "Saved" } : result
    })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="space-y-1">
        <span className={labelText}>Name</span>
        <Input value={nameValue} onValueChange={setName} placeholder="Your name" />
      </label>
      <label className="space-y-1">
        <span className={labelText}>Phone</span>
        <Input
          type="tel"
          value={phoneValue}
          onValueChange={setPhone}
          placeholder="Your phone"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
