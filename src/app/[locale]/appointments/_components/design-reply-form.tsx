"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { BodySm } from "@/components/ui/typography"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { discardUploadedRef } from "@/modules/design/ref-actions"
import {
  addDesignMessage,
  addDesignRef,
} from "@/modules/design/request-actions"
import { MAX_MESSAGE_LENGTH, MAX_REFS_PER_REQUEST } from "@/shared/design"

/**
 * The client's side of the conversation — a note back, with an optional extra
 * photo. Without this the thread was one-way: the artist could reply, and the
 * client could only start over with a new request.
 *
 * The photo is attached as its own step (upload, then `addDesignRef`) so a
 * failed image never costs the message, which is the part that matters.
 */
export function DesignReplyForm({
  requestId,
  refCount,
}: {
  requestId: string
  /** Photos already on this request — the cap is server-enforced too. */
  refCount: number
}) {
  const t = useTranslations("designRequests")
  const router = useRouter()
  const [body, setBody] = useState("")
  const [photoKey, setPhotoKey] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const { inputRef, uploading, pick, take } = usePhotoUpload({
    processFailed: t("replyPhotoFailed"),
    notConfigured: t("replyPhotoNotConfigured"),
    rateLimited: t("replyPhotoSlowDown"),
    unsupported: t("replyPhotoUnsupported"),
    failed: t("replyPhotoFailed"),
  })

  // One photo per reply. `refCount` is the true DB count — the displayed list is
  // pruned, so it can't be used to decide the cap.
  const atCap = refCount >= MAX_REFS_PER_REQUEST
  const roomForPhoto = !photoKey && !atCap

  const onFile = async (files: FileList | null) => {
    const key = await take(files)
    if (key) {
      setPhotoKey(key)
    }
  }

  // Already uploaded, so removing it has to reach the bucket too — otherwise a
  // photo the client took back sits in storage until the orphan sweep runs.
  // Refused mid-send: `addDesignRef` may be inserting the row for this very key.
  const dropPhoto = () => {
    if (sending) {
      return
    }
    if (photoKey) {
      discardUploadedRef(photoKey).catch(() => {
        /* the orphan sweep is the backstop */
      })
    }
    setPhotoKey(null)
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!body.trim() || sending || uploading) {
      return
    }
    setSending(true)
    try {
      const sent = await addDesignMessage(requestId, body)
      if (!sent.ok) {
        toast.error(sent.error || t("replyFailed"))

        return
      }
      // The message is in. A photo that fails now is worth a warning, not a
      // rollback — the studio can still read what they wrote.
      // The message is in. If the photo won't attach, KEEP it staged — clearing
      // it would abandon an uploaded object the UI promised to send, with no way
      // to retry.
      if (photoKey) {
        const attached = await addDesignRef(requestId, photoKey)
        if (attached.ok) {
          setPhotoKey(null)
        } else {
          toast.warning(attached.error || t("replyPhotoFailed"))
        }
      }
      setBody("")
      router.refresh()
    } catch {
      toast.error(t("replyFailed"))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={send} className="space-y-3 pt-2">
      <label
        htmlFor={`reply-${requestId}`}
        className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground"
      >
        {t("replyLabel")}
      </label>
      <Textarea
        id={`reply-${requestId}`}
        aria-describedby={
          photoKey && !body.trim() ? `reply-hint-${requestId}` : undefined
        }
        rows={3}
        maxLength={MAX_MESSAGE_LENGTH}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("replyPlaceholder")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={sending || uploading || !body.trim()}
        >
          {sending ? t("replySending") : t("replySend")}
        </Button>

        {roomForPhoto ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => onFile(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={pick}
              className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {uploading ? t("replyPhotoUploading") : t("replyPhotoAdd")}
            </button>
          </>
        ) : null}

        {photoKey ? (
          <span className="flex items-center gap-2">
            <BodySm className="text-xs text-muted-foreground">
              {t("replyPhotoAttached")}
            </BodySm>
            <button
              type="button"
              disabled={sending}
              onClick={dropPhoto}
              className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t("replyPhotoRemove")}
            </button>
          </span>
        ) : null}

        {atCap && !photoKey ? (
          <BodySm className="text-xs text-muted-foreground">
            {t("replyPhotoTooMany")}
          </BodySm>
        ) : null}
      </div>

      {/* A note is required — the artist is notified on a message, not on a
          bare attachment, so a photo alone would arrive silently. */}
      {photoKey && !body.trim() ? (
        <BodySm
          id={`reply-hint-${requestId}`}
          className="text-xs text-muted-foreground"
        >
          {t("replyNeedsNote")}
        </BodySm>
      ) : null}
    </form>
  )
}
