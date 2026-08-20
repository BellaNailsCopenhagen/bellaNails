"use client"

import type * as React from "react"

import {
  ConfirmActionButton,
  type ConfirmLabels,
} from "@/components/sections/confirm-action-button"
import { deleteOwnMedia } from "@/modules/media/client-media-actions"

/** Confirm-then-delete for a client's own media (real erasure, incl. published
    copies). Thin wrapper over ConfirmActionButton. */
export function DeleteOwnMediaButton({
  mediaId,
  trigger,
  labels,
}: {
  mediaId: string
  trigger: React.ReactElement
  labels: ConfirmLabels
}) {
  return (
    <ConfirmActionButton
      action={() => deleteOwnMedia(mediaId)}
      trigger={trigger}
      labels={labels}
    />
  )
}
