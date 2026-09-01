import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { DESIGN_STATUSES, DESIGN_TOPICS } from "@/shared/design"
import { OFFER_STATES_BLOCKED } from "@/shared/offer"

/**
 * The client UI builds message keys from a union — `t(`status.${s}`)`,
 * `t(`topic.${t}`)`, `t(`blocked.${state}`)`. next-intl resolves those at RENDER
 * time and throws on a miss, so neither `tsc` nor the build catches a gap: it
 * surfaces as a crashed page for whichever state happens to occur.
 *
 * These walk each union against BOTH catalogs, so adding a status or a topic
 * without its copy fails here instead of in front of a client.
 */
const catalog = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"))

const LOCALES = ["da", "en"]

const assertKeys = (
  locale: string,
  namespace: string,
  group: string,
  values: readonly string[],
) => {
  const messages = catalog(locale)
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

test("every design topic has copy in both locales", () => {
  for (const locale of LOCALES) assertKeys(locale, "ask", "topic", DESIGN_TOPICS)
})

test("every design status has copy in both locales", () => {
  for (const locale of LOCALES) {
    assertKeys(locale, "designRequests", "status", DESIGN_STATUSES)
  }
})

test("every non-live offer state has copy in both locales", () => {
  for (const locale of LOCALES) {
    assertKeys(locale, "offer", "blocked", OFFER_STATES_BLOCKED)
  }
})

test("the two catalogs expose the same namespaces", () => {
  const [da, en] = LOCALES.map((l) => Object.keys(catalog(l)).sort())
  assert.deepEqual(da, en)
})
