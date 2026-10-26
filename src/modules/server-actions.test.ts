import assert from "node:assert/strict"
import { test } from "node:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/**
 * The invariant: no remote-callable action reaches the database without first
 * establishing who is calling.
 *
 * A `"use server"` file exports an RPC endpoint — anyone who can reach the app
 * can invoke it with any arguments. So every exported function in one that
 * touches a Supabase client has to do one of three things: `requireOwner()`,
 * read the session, or verify a signed token. QA-18 found nine READS relying on
 * the proxy instead; this is what stops the tenth appearing quietly.
 *
 * Deliberately a structural test rather than a lint rule: the check is "which
 * of three authorization moves does this function make", which reads far more
 * clearly as an assertion than as an AST selector.
 */

/**
 * The authorization moves that count. A named ownership helper counts too —
 * `ownTestimonial()` reads the session AND checks `client_id`, which is a
 * stronger gate than a bare session read, and the first run of this test
 * flagged its three callers because it could not see through the indirection.
 * Naming the helper here is the fix; loosening the check would not have been.
 */
const GATES = [
  "requireOwner(",
  "getCurrentUser(",
  "getAuthUser(",
  "callerId(",
  "ownTestimonial(",
  "verifyBookingToken(",
  "verifyOfferToken(",
  "verifyTestimonialToken(",
  "verifyReleaseToken(",
]

/**
 * Exported functions that legitimately establish nothing themselves.
 *
 * Each is either a pure pass-through to something that does its own gating, or
 * a public read that exposes no one's data. Adding to this list should feel
 * like a decision — that is the point of it being here rather than implicit.
 */
const ALLOWED: Record<string, string> = {
  // Free times only — no client data, and the same information the public
  // booking calendar already renders.
  "create-booking-actions.ts:getOutsideSlotsForBooking":
    "public availability read; exposes free times, not people",
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)

    return statSync(full).isDirectory()
      ? walk(full)
      : full.endsWith(".ts") && !full.endsWith(".test.ts")
        ? [full]
        : []
  })
}

/** Each exported function's name and body, split on the next top-level export. */
function exportedFunctions(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  const header = /export\s+(?:async\s+)?function\s+(\w+)/g
  let match: RegExpExecArray | null
  while ((match = header.exec(source)) !== null) {
    const rest = source.slice(match.index + 1)
    const next = /\nexport\s+(?:async\s+)?(?:function|const|type)\s/.exec(rest)
    out.push({
      name: match[1],
      body: next ? rest.slice(0, next.index) : rest,
    })
  }

  return out
}

test("every remote-callable action establishes its caller", () => {
  const files = walk("src/modules").filter((f) => {
    const s = readFileSync(f, "utf8")

    return s.startsWith('"use server"') && s.includes("Supabase")
  })
  assert.ok(
    files.length >= 10,
    `expected the action surface, found ${files.length}`,
  )

  const ungated: string[] = []
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const { name, body } of exportedFunctions(source)) {
      const key = `${path.basename(file)}:${name}`
      if (key in ALLOWED) {
        continue
      }
      if (!GATES.some((gate) => body.includes(gate))) {
        ungated.push(key)
      }
    }
  }
  assert.deepEqual(
    ungated,
    [],
    `these "use server" exports touch the database without establishing who is ` +
      `calling. Add a gate, or add the name to ALLOWED with the reason:\n  ` +
      ungated.join("\n  "),
  )
})

test("the helpers that skip a gate are server-only, so nothing can call them", () => {
  // `fetchClientContacts`, `ensureUser`, `getBookingForSignedToken`,
  // `recordCommunication` and `purgeMediaArtifacts` all use service-role
  // without a gate of their own. That is correct BECAUSE they are unreachable
  // from a browser — their callers do the gating. If one ever loses
  // `server-only`, it becomes reachable and this fails.
  for (const file of [
    "src/modules/clients/contacts.ts",
    "src/modules/identity/ensure-user.ts",
    "src/modules/booking/reads.ts",
    "src/modules/notifications/communications.ts",
    "src/modules/media/erasure.ts",
  ]) {
    const source = readFileSync(file, "utf8")
    assert.ok(
      source.includes('import "server-only"'),
      `${file} lost server-only`,
    )
    assert.ok(
      !source.startsWith('"use server"'),
      `${file} became an action file`,
    )
  }
})
