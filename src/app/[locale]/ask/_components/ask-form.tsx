"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { discardUploadedRef } from "@/modules/design/ref-actions"
import { createDesignRequest } from "@/modules/design/request-actions"
import {
  DESIGN_TOPICS,
  MAX_MESSAGE_LENGTH,
  MAX_PREFERRED_WINDOW_LENGTH,
  MAX_REFS_PER_REQUEST,
  type DesignTopic,
} from "@/shared/design"
import { routes } from "@/config/routes"

type Attachment = { key: string; previewUrl: string }

/**
 * The client's message to the artist. Photos upload as they're picked (each is
 * optimised + EXIF-stripped in the browser first) and the returned storage keys
 * travel with the submit, so a half-finished form never leaves a request behind.
 *
 * On success the form is replaced by a plain acknowledgement rather than a
 * redirect — the client stays where they are and can read what happens next.
 */
export function AskForm({
  defaultTopic,
  bookingId,
  serviceId,
}: {
  defaultTopic: DesignTopic
  bookingId?: string
  serviceId?: string
}) {
  const t = useTranslations("ask")
  const locale = useLocale()
  const router = useRouter()

  const [topic, setTopic] = useState<DesignTopic>(defaultTopic)
  const [message, setMessage] = useState("")
  const [when, setWhen] = useState("")
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { inputRef, uploading, pick, take } = usePhotoUpload({
    processFailed: t("photoFailed"),
    notConfigured: t("photoNotConfigured"),
    rateLimited: t("photoSlowDown"),
    unsupported: t("photoUnsupported"),
    failed: t("photoFailed"),
  })

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }
    if (photos.length >= MAX_REFS_PER_REQUEST) {
      toast.error(t("photoTooMany"))

      return
    }
    // Hold the File now: `take` resets the input, so `files` is empty after it.
    const previewUrl = URL.createObjectURL(file)
    const key = await take(files)
    if (!key) {
      URL.revokeObjectURL(previewUrl)

      return
    }
    setPhotos((prev) => [...prev, { key, previewUrl }])
  }

  // Removing means removing: the object is already in the bucket, so it is
  // deleted now rather than left for the orphan sweep to find days later. The
  // UI drops it either way — a failed delete is the sweep's problem, not the
  // client's. Refused mid-submit: the key is already on its way to a row.
  const removePhoto = (key: string) => {
    if (sending) {
      return
    }
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key)
      if (gone) {
        URL.revokeObjectURL(gone.previewUrl)
      }

      return prev.filter((p) => p.key !== key)
    })
    discardUploadedRef(key).catch(() => {
      /* the orphan sweep is the backstop */
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!message.trim() || sending) {
      return
    }
    setSending(true)
    try {
      const result = await createDesignRequest({
        locale,
        topic,
        message,
        refKeys: photos.map((p) => p.key),
        preferredWindow: when || undefined,
        bookingId,
        serviceId,
      })
      if (!result.ok) {
        toast.error(result.error || t("failed"))

        return
      }
      setSent(true)
      router.refresh()
    } catch {
      toast.error(t("failed"))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-5 border-t border-border pt-8">
        <Eyebrow>{t("sentTitle")}</Eyebrow>
        <BodySm>{t("sentBody")}</BodySm>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push(routes.appointments)}>
            {t("sentCta")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSent(false)
              setMessage("")
              setWhen("")
              setPhotos([])
            }}
          >
            {t("askAnother")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-8 border-t border-border pt-8">
      <fieldset className="space-y-3">
        <legend className="font-functional text-sm text-foreground">
          {t("topicLabel")}
        </legend>
        {DESIGN_TOPICS.map((value) => (
          <label key={value} className="flex items-center gap-2.5">
            <input
              type="radio"
              name="topic"
              value={value}
              checked={topic === value}
              onChange={() => setTopic(value)}
              className="size-4"
            />
            <span className="font-functional text-sm text-foreground">
              {t(`topic.${value}`)}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Label htmlFor="ask-photo">{t("photosLabel")}</Label>
          <span className="font-functional text-xs text-muted-foreground">
            {t("photosOptional", { max: MAX_REFS_PER_REQUEST })}
          </span>
        </div>

        {photos.length ? (
          <ul className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <li key={photo.key} className="relative">
                {/* A local blob preview — no signed URL round trip needed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={t("photoAlt")}
                  className="size-20 rounded-sm border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label={t("removePhoto")}
                  disabled={sending}
                  onClick={() => removePhoto(photo.key)}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <input
          id="ask-photo"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => onFile(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || photos.length >= MAX_REFS_PER_REQUEST}
          onClick={pick}
        >
          {uploading ? t("uploading") : t("addPhoto")}
        </Button>
        <BodySm className="text-xs text-muted-foreground">
          {t("photosHint")} {t("photoNote")}
        </BodySm>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ask-message">{t("messageLabel")}</Label>
        <Textarea
          id="ask-message"
          required
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <Label htmlFor="ask-when">{t("windowLabel")}</Label>
          <span className="font-functional text-xs text-muted-foreground">
            {t("windowOptional")}
          </span>
        </div>
        <Input
          id="ask-when"
          value={when}
          maxLength={MAX_PREFERRED_WINDOW_LENGTH}
          onChange={(e) => setWhen(e.target.value)}
          placeholder={t("windowPlaceholder")}
        />
      </div>

      <div className="space-y-3">
        <Button type="submit" disabled={sending || !message.trim()}>
          {sending ? t("submitting") : t("submit")}
        </Button>
        <BodySm className="text-xs text-muted-foreground">
          {t("replyTime")}
        </BodySm>
      </div>
    </form>
  )
}
