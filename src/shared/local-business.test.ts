import assert from "node:assert/strict"
import { test } from "node:test"

import { localBusinessSchema } from "@/shared/local-business"
import type { Schedule } from "@/shared/schedule"

const profile = {
  addressLine1: "Halldór Laxness Vej 3, 2. th",
  addressLine2: "2300 København",
  contactEmail: "home@bellanails.dk",
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
}

// Sat + Sun 10:00–18:00, the pattern the studio actually runs.
const weekend: Schedule = [
  { kind: "standard", weekday: 5, onDate: null, start: "10:00", end: "18:00" },
  { kind: "standard", weekday: 6, onDate: null, start: "10:00", end: "18:00" },
]

const build = (schedule: Schedule = weekend) =>
  localBusinessSchema({
    name: "Bella Nails",
    url: "https://bellanails.dk/da",
    profile,
    schedule,
    areaServed: ["Ørestad", "Amager"],
  })

test("the opening hours come from the schedule, not from prose", () => {
  const spec = build().openingHoursSpecification as {
    dayOfWeek: string
    opens: string
    closes: string
  }[]
  assert.deepEqual(
    spec.map((s) => s.dayOfWeek),
    ["https://schema.org/Saturday", "https://schema.org/Sunday"],
  )
  assert.equal(spec[0].opens, "10:00")
  assert.equal(spec[0].closes, "18:00")
})

test("an off-hours block inside a working day is subtracted, as on the page", () => {
  // The visible table shows two ranges here, so the markup must too.
  const withLunch: Schedule = [
    { kind: "standard", weekday: 0, onDate: null, start: "09:00", end: "17:00" },
    { kind: "no_work", weekday: 0, onDate: null, start: "12:00", end: "13:00" },
  ]
  const spec = build(withLunch).openingHoursSpecification as {
    opens: string
    closes: string
  }[]
  assert.deepEqual(
    spec.map((s) => [s.opens, s.closes]),
    [
      ["09:00", "12:00"],
      ["13:00", "17:00"],
    ],
  )
})

test("a Danish post town splits into postal code and locality", () => {
  assert.deepEqual(build().address, {
    "@type": "PostalAddress",
    streetAddress: "Halldór Laxness Vej 3, 2. th",
    postalCode: "2300",
    addressLocality: "København",
    addressCountry: "DK",
  })
})

test("nothing is claimed that isn't set", () => {
  const bare = localBusinessSchema({
    name: "Bella Nails",
    url: "https://bellanails.dk/da",
    profile: { ...profile, addressLine1: "", addressLine2: "", contactEmail: "" },
    schedule: [],
    areaServed: [],
  })
  for (const absent of [
    "address",
    "email",
    "areaServed",
    "sameAs",
    "openingHoursSpecification",
  ]) {
    assert.equal(absent in bare, false, `${absent} should be omitted`)
  }
  // And there is no invented phone or geo, which the SEO plan still owes.
  assert.equal("telephone" in bare, false)
  assert.equal("geo" in bare, false)
})

test("only the socials she has actually set are linked", () => {
  const some = localBusinessSchema({
    name: "Bella Nails",
    url: "https://bellanails.dk/da",
    profile: { ...profile, instagramUrl: "https://instagram.com/bellanails" },
    schedule: weekend,
    areaServed: [],
  })
  assert.deepEqual(some.sameAs, ["https://instagram.com/bellanails"])
})
