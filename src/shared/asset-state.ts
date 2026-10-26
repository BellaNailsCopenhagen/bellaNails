/**
 * What a photo needs next — the asset hub's one state rule.
 *
 * Every image is the artist's own now (the client-upload pipeline is retired),
 * so the hub is her work queue and each state answers one question: whose move
 * is it? Consent belongs to the client and is granted per booking and per
 * purpose; publication belongs to the artist and is per photo. The ladder below
 * reads the two together, in the order that decides what to do next.
 *
 * Pure and isomorphic — no icons, no vendor, no service. The icon each state
 * wears is a UI decision and lives in components/admin/asset-state.tsx.
 */

/** Purposes that can actually produce a public copy. `education` is permission
    to teach from a photo — it publishes nothing, so it must never put a photo in
    a queue that promises somewhere to place it. */
export const PUBLISHABLE_PURPOSES = ["website", "social"] as const
export type PublishablePurpose = (typeof PUBLISHABLE_PURPOSES)[number]

export type AssetState =
  | "unlinked"
  | "to_ask"
  | "waiting"
  | "ready"
  | "live"
  | "declined"
  | "retracted"
  | "takedown"

/** The tabs, in the order a photo travels through them. `takedown` is missing on
    purpose: it is an alarm, not a stage, and the hub raises it above the tabs so
    it can't sit unread in a strip the artist has no reason to open. */
export const ASSET_STATE_ORDER = [
  "unlinked",
  "to_ask",
  "waiting",
  "ready",
  "live",
  "declined",
  "retracted",
] as const

export const ASSET_STATE_LABEL: Record<AssetState, string> = {
  unlinked: "No appointment",
  to_ask: "To ask",
  waiting: "Waiting",
  ready: "Ready",
  live: "Live",
  declined: "Declined",
  retracted: "Retracted",
  takedown: "Needs takedown",
}

export const ASSET_STATE_TOOLTIP: Record<AssetState, string> = {
  unlinked:
    "Not attached to an appointment, so there is nobody to ask — re-add these from the appointment they belong to",
  to_ask: "You haven’t asked this client’s permission yet",
  waiting: "Asked — waiting on the client’s answer",
  ready: "Permission given — choose where to use it",
  live: "In use on the website or on social",
  declined: "You asked and the client said no",
  retracted: "The client allowed it once and has since taken that back",
  takedown:
    "Permission withdrawn while it was on social — remove the post, then confirm",
}

/** One published public copy of an original, for one purpose. */
export type PublishedCopy = {
  purpose: string
  needsTakedown: boolean
  /** How many surfaces it sits on. Zero means a public file nothing renders. */
  placements: number
}

/**
 * Where this photo stands. Read top to bottom — the first line that matches wins,
 * because that is the most urgent true thing about it.
 *
 * Publication is checked before consent: a release covers every photo of a
 * booking, so a purpose still pending on one of them must not mask a photo
 * that is already public for another. Among the consent answers a refusal
 * outranks silence, so a photo the client turned down stops nagging from the
 * "to ask" queue — the card still shows the other purposes if she wants to ask.
 */
export function deriveAssetState(
  releases: Record<string, string>,
  published: PublishedCopy[],
  /** False for photos with no appointment: permission is asked per appointment,
      so there is no one to ask and no queue they belong in. */
  linked = true,
): AssetState {
  if (!linked) {
    return "unlinked"
  }
  if (published.some((copy) => copy.needsTakedown)) {
    return "takedown"
  }
  if (published.some((copy) => copy.placements > 0)) {
    return "live"
  }

  const answers = PUBLISHABLE_PURPOSES.map((p) => releases[p] ?? "none")
  if (answers.includes("granted")) {
    return "ready"
  }
  if (answers.includes("requested")) {
    return "waiting"
  }
  // A permission taken back is not the same event as one never given: the photo
  // may have been public, and someone changed their mind about it. Kept apart so
  // the artist can see which is which without opening anything.
  if (answers.includes("withdrawn")) {
    return "retracted"
  }
  if (answers.includes("declined")) {
    return "declined"
  }

  return "to_ask"
}

/** Can permission be asked for (or asked again) for this purpose? Silence and a
    refusal are both askable; a live request or a standing grant are not. */
export function canRequestRelease(status: string | undefined): boolean {
  return (
    !status ||
    status === "none" ||
    status === "declined" ||
    status === "withdrawn"
  )
}

/** How long a photo counts as newly added. Long enough to survive a week of not
    opening the admin, short enough that "new" still means something. */
export const NEW_PHOTO_DAYS = 7

/** Recently uploaded — the mark that lets the artist find what she just added
    without remembering which appointment she added it to. */
export function isNewPhoto(createdAtIso: string, now: number): boolean {
  const added = Date.parse(createdAtIso)
  if (Number.isNaN(added)) {
    return false
  }

  return now - added < NEW_PHOTO_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Does this photo wear the "New" mark? Recently added AND never published — the
 * pair is the point: it is the queue of things waiting to be used, not a list of
 * everything recent. One definition, because the badge on the tile and the pill
 * that counts them drifted apart the moment there were two.
 */
export function isAwaitingUse(
  photo: { createdAt: string; published: unknown[] },
  now: number,
): boolean {
  return isNewPhoto(photo.createdAt, now) && photo.published.length === 0
}
