"use client"

import { useEffect } from "react"

import { markDesignThreadsSeen } from "@/modules/design/request-actions"

/**
 * Records that the client has read their threads — the panel only mounts when
 * its tab is showing, so mounting IS the reading.
 *
 * Two things it deliberately does NOT do. It doesn't refresh the route: that
 * would wipe the "new reply" badges within a frame of arriving, leaving someone
 * with five threads to hunt for the answer they came for. And it marks seen up
 * to `seenAt` — the newest answer this render actually showed — not the clock,
 * so a reply that lands mid-visit stays unread until it has been on screen.
 */
export function DesignThreadsSeen({ seenAt }: { seenAt: string | null }) {
  useEffect(() => {
    if (!seenAt) return
    markDesignThreadsSeen(seenAt).catch(() => {
      /* a read-marker that doesn't stick is not worth telling anyone about */
    })
  }, [seenAt])

  return null
}
