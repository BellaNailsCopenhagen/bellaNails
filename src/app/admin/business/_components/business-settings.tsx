"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { MapImageField } from "@/app/admin/business/_components/map-image-field"
import { useActionRunner } from "@/hooks/use-action-runner"
import { saveBusinessProfile } from "@/modules/business/profile-actions"
import type { BusinessProfileInput } from "@/shared/business-profile"

type Field = {
  id: keyof BusinessProfileInput
  label: string
  placeholder: string
  help: string
}

const ADDRESS: Field[] = [
  {
    id: "addressLine1",
    label: "Street",
    placeholder: "e.g. Example Street 12, 2nd floor",
    help: "",
  },
  {
    id: "addressLine2",
    label: "Post code and town",
    placeholder: "e.g. 1000 Copenhagen",
    help: "Shown on the site and in confirmation emails, and it's what the map link points at.",
  },
]

const CONTACT: Field[] = [
  {
    id: "contactEmail",
    label: "Contact address",
    placeholder: "e.g. hello@yourdomain.com",
    help: "Shown on the site, where replies go, and the address your messages and offers are sent from. Your mail provider has to let you send as it — otherwise those emails are rejected. Blank uses the built-in one.",
  },
  {
    id: "bookingFromEmail",
    label: "Booking emails come from",
    placeholder: "e.g. bookings@yourdomain.com",
    help: "Confirmations and reminders are sent from here. Same rule: it must be an address your mail provider lets you send as. Blank uses the built-in one.",
  },
  {
    id: "alertEmail",
    label: "Send my alerts to",
    placeholder: "e.g. you@yourdomain.com",
    help: "Where we write to YOU — a client replied, a booking request needs a decision. This one can be your own mailbox: nothing checks who a message is addressed to. Blank sends them to the contact address.",
  },
]

const SOCIAL: Field[] = [
  {
    id: "instagramUrl",
    label: "Instagram",
    placeholder: "@yourhandle",
    help: "",
  },
  { id: "facebookUrl", label: "Facebook", placeholder: "yourpage", help: "" },
  { id: "tiktokUrl", label: "TikTok", placeholder: "@yourhandle", help: "" },
]

/**
 * The studio's own details. These used to be constants compiled into the app,
 * so a new handle or a changed mailbox meant a code change and a deploy.
 *
 * Blank is meaningful: an address falls back to the built-in one, and a social
 * link disappears from the footer rather than pointing at instagram.com.
 */
export function BusinessSettings({
  profile,
  mapImageUrl,
}: {
  profile: BusinessProfileInput
  /** The map picture in use — the uploaded one, or the shipped illustration. */
  mapImageUrl: string
}) {
  const { pending, run } = useActionRunner()
  const [form, setForm] = useState<BusinessProfileInput>(profile)

  const set = (id: keyof BusinessProfileInput, value: string) =>
    setForm((current) => ({ ...current, [id]: value }))

  const dirty = (Object.keys(form) as (keyof BusinessProfileInput)[]).some(
    (key) => form[key] !== profile[key],
  )

  const field = (f: Field) => (
    <div key={f.id} className="space-y-1">
      <Label htmlFor={f.id} className="text-[10px] tracking-widest-lux">
        {f.label}
      </Label>
      <Input
        id={f.id}
        value={form[f.id]}
        onChange={(e) => set(f.id, e.target.value)}
        placeholder={f.placeholder}
        autoComplete="off"
      />
      {f.help ? (
        <BodySm className="text-xs text-muted-foreground">{f.help}</BodySm>
      ) : null}
    </div>
  )

  return (
    <section className="space-y-6">
      <BodySm className="text-xs">
        Anything you leave blank falls back to the built-in setting, and a social
        account you don’t fill in simply isn’t shown.
      </BodySm>

      <div className="space-y-5">
        <Eyebrow as="h3">Where you are</Eyebrow>
        {ADDRESS.map(field)}
      </div>

      <MapImageField currentUrl={mapImageUrl} />

      <div className="space-y-5">
        <Eyebrow as="h3">Email</Eyebrow>
        {CONTACT.map(field)}
      </div>

      <div className="space-y-5">
        <Eyebrow as="h3">Social</Eyebrow>
        <BodySm className="text-xs text-muted-foreground">
          A handle or a full link — either works.
        </BodySm>
        {SOCIAL.map(field)}
      </div>

      <Button
        size="sm"
        disabled={pending || !dirty}
        onClick={() =>
          run(async () => {
            const result = await saveBusinessProfile(form)
            // A handle is stored as a full URL, so show back what was SAVED —
            // otherwise the form stays "dirty" against text it no longer holds.
            if (result.ok) setForm(result.saved)
            return result
          })
        }
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </section>
  )
}
