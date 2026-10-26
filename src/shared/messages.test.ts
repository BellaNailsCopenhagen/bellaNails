import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { BOOKING_STATUS } from "@/shared/booking-status"
import { DESIGN_STATUSES, DESIGN_TOPICS } from "@/shared/design"
import { OFFER_STATES_BLOCKED } from "@/shared/offer"
import { TESTIMONIAL_STATES } from "@/shared/testimonial"

/**
 * Message keys the UI builds from a union — `t(`status.${s}`)`, `t(`state.${s}`)`.
 * next-intl resolves those at RENDER time and throws on a miss, so neither `tsc`
 * nor the build catches a gap: it surfaces as a crashed page for whichever value
 * happens to occur. Each union is walked against BOTH catalogs here instead.
 */
const LOCALES = ["da", "en"]

const catalog = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../messages/${locale}.json`, import.meta.url),
      "utf8",
    ),
  )

/** One dynamic key site: which namespace, which group, which values. */
const DYNAMIC_KEYS: [
  namespace: string,
  group: string,
  values: readonly string[],
][] = [
  ["ask", "topic", DESIGN_TOPICS],
  ["designRequests", "status", DESIGN_STATUSES],
  ["offer", "blocked", OFFER_STATES_BLOCKED],
  ["testimonialForm", "state", TESTIMONIAL_STATES],
  // Plus the derived "completed", which is shown but never stored.
  ["bookings", "status", [...Object.values(BOOKING_STATUS), "completed"]],
]

test("every dynamic message key has copy in both locales", () => {
  for (const locale of LOCALES) {
    const messages = catalog(locale)
    for (const [namespace, group, values] of DYNAMIC_KEYS) {
      const block = messages[namespace]?.[group]
      assert.ok(block, `${locale}: ${namespace}.${group} is missing entirely`)
      for (const value of values) {
        assert.equal(
          typeof block[value],
          "string",
          `${locale}: ${namespace}.${group}.${value} is missing`,
        )
      }
    }
  }
})

/** Every leaf path in an object, so a key added to one locale only is caught. */
function leaves(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return [prefix]
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  )
}

test("the two catalogs hold exactly the same keys", () => {
  const [da, en] = LOCALES.map((l) => leaves(catalog(l)).sort())
  const daOnly = da.filter((k) => !en.includes(k))
  const enOnly = en.filter((k) => !da.includes(k))
  assert.deepEqual(daOnly, [], `da-only keys: ${daOnly.join(", ")}`)
  assert.deepEqual(enOnly, [], `en-only keys: ${enOnly.join(", ")}`)
})
