import { auth } from "@clerk/nextjs/server"

import { isOwner } from "@/lib/admin/owner"
import { extForType, uploadPolicy } from "@/lib/media-policy"
import { presignedUpload } from "@/lib/storage/scaleway"

/**
 * Presigned-POST params for a browser upload into `private/`. Requires a signed-in
 * caller; the role (owner vs client) picks the policy — allowed types + max size
 * (decision 9). A client asking for a video is rejected. Returns 503 when storage
 * isn't configured, so the uploader degrades to "not yet available".
 */
export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return new Response("Unauthorized", { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    contentType?: string
  } | null
  const contentType = body?.contentType
  const { allowedTypes, maxBytes } = uploadPolicy(isOwner(sessionClaims))
  if (!contentType || !allowedTypes.includes(contentType)) {
    return Response.json({ error: "unsupported_type" }, { status: 400 })
  }

  const result = await presignedUpload({
    contentType,
    maxBytes,
    ext: extForType(contentType),
  })
  if (!result.ok) {
    const status = result.error === "not_configured" ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }
  return Response.json(result.data)
}
