"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { submitTestimonial } from "@/modules/testimonials/actions"
import {
  TESTIMONIAL_MAX_BODY,
  TESTIMONIAL_MAX_NAME,
  TESTIMONIAL_MAX_OCCUPATION,
  TESTIMONIAL_MIN_BODY,
  validateTestimonial,
} from "@/shared/testimonial"

/**
 * Three fields and a send. Validated with the same `validateTestimonial` the
 * action uses, so the button's disabled state and the server's answer can never
 * disagree — the usual cause of a form that refuses without saying why.
 *
 * On success it becomes a thank-you rather than redirecting: the person came
 * from an email and has nowhere in particular to be sent.
 */
export function TestimonialForm({ token }: { token: string }) {
  const t = useTranslations("testimonialForm")
  const [authorName, setAuthorName] = useState("")
  const [occupation, setOccupation] = useState("")
  const [body, setBody] = useState("")
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const check = validateTestimonial({ authorName, occupation, body, consent })
  const tooShort =
    body.trim().length > 0 && body.trim().length < TESTIMONIAL_MIN_BODY

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!check.ok || sending) return
    setSending(true)
    try {
      const result = await submitTestimonial({
        token,
        authorName,
        occupation,
        body,
        consent,
      })
      if (!result.ok) {
        toast.error(result.error || t("failed"))
        return
      }
      setDone(true)
    } catch {
      toast.error(t("failed"))
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 border-t border-border pt-8">
        <Eyebrow>{t("thanksTitle")}</Eyebrow>
        <BodySm className="max-w-prose">{t("thanksBody")}</BodySm>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-8 border-t border-border pt-8">
      <div className="space-y-2">
        <Label htmlFor="t-name">{t("nameLabel")}</Label>
        <Input
          id="t-name"
          required
          maxLength={TESTIMONIAL_MAX_NAME}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder={t("namePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <Label htmlFor="t-occupation">{t("occupationLabel")}</Label>
          <span className="font-functional text-xs text-muted-foreground">
            {t("occupationOptional")}
          </span>
        </div>
        <Input
          id="t-occupation"
          maxLength={TESTIMONIAL_MAX_OCCUPATION}
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          placeholder={t("occupationPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="t-body">{t("bodyLabel")}</Label>
        <Textarea
          id="t-body"
          required
          rows={4}
          maxLength={TESTIMONIAL_MAX_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          aria-describedby="t-body-help"
        />
        <div
          id="t-body-help"
          className="flex flex-wrap justify-between gap-2 font-functional text-xs text-muted-foreground"
        >
          <span>
            {tooShort ? t("bodyTooShort", { min: TESTIMONIAL_MIN_BODY }) : ""}
          </span>
          <span>
            {t("bodyCounter", {
              count: body.trim().length,
              max: TESTIMONIAL_MAX_BODY,
            })}
          </span>
        </div>
      </div>

      {/* Required: publication is the whole purpose, so there is no
          un-consented testimonial to keep. Withdrawable at any time, which is
          what the label says. */}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-4 shrink-0"
        />
        <span className="font-functional text-sm leading-relaxed text-foreground">
          {t("consentLabel")}
        </span>
      </label>

      <Button type="submit" disabled={sending || !check.ok}>
        {sending ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
