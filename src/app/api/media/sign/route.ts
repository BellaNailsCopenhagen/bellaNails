import { getCurrentUser } from "@/modules/identity/server"
import { takeToken, type RateLimitState } from "@/shared/rate-limit"
import { extForType, imagePolicy, uploadPolicy } from "@/shared/media-policy"
import { signedUploadUrl, type SignedUploadTarget } from "@/platform/storage/supabase"

/**
 * Mints a one-shot signed upload target. Requires a signed-in caller; the role
 * picks the allowed types (checked here), the bucket — the artist's originals vs
 * a client's design references, each with its own server-enforced size limit —
 * and the image tier the browser must optimise to. A client asking for a video
 * is rejected. Returns 503 when storage isn't configured, so the uploader
 * degrades to "not yet available".
 *
 * The tier is answered here rather than chosen by the uploader: the artist's
 * photos are the portfolio and a client's are references, and that is the same
 * `isOwner` question the bucket already turns on. A browser that picked its own
 * could ask for the bigger one.
 *
 * Clients are rate-limited: the per-request and per-client caps elsewhere bound
 * ROWS, and an upload happens before any row exists, so nothing else stops one
 * account minting objects in a loop. Best-effort (per instance) — see
 * shared/rate-limit.ts — and deliberately generous enough that a real person
 * attaching three photos never notices.
 */

const uploads: RateLimitState = new Map()
const CLIENT_UPLOAD_RULE = { limit: 20, windowMs: 60 * 60 * 1000 }
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // The artist is trusted; a client is not.
  if (!user.isOwner && !takeToken(uploads, user.id, Date.now(), CLIENT_UPLOAD_RULE)) {
    return Response.json({ error: "rate_limited" }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as {
    contentType?: string
  } | null
  const contentType = body?.contentType
  const { allowedTypes } = uploadPolicy(user.isOwner)
  if (!contentType || !allowedTypes.includes(contentType)) {
    return Response.json({ error: "unsupported_type" }, { status: 400 })
  }

  const result = await signedUploadUrl({
    area: user.isOwner ? "private" : "refs",
    ext: extForType(contentType),
  })
  if (!result.ok) {
    const status = result.error === "not_configured" ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }
  const target: SignedUploadTarget = result.data
  // Where to PUT, plus how to prepare the image before PUTting it.
  return Response.json({ ...target, image: imagePolicy(user.isOwner) })
}
