import assert from "node:assert/strict"
import { test } from "node:test"

import {
  asBookingAccessLevel,
  blockLookupsFor,
  isSelectableLevel,
  normalizeBlockValue,
  requiresCard,
  requiresVerifiedIdentity,
} from "./booking-protection"

test("only the open level lets an unverified booker through", () => {
  assert.equal(requiresVerifiedIdentity("open"), false)
  assert.equal(requiresVerifiedIdentity("verified"), true)
  assert.equal(requiresVerifiedIdentity("card"), true)
})

test("the card level is offered but not selectable until Stripe exists", () => {
  assert.equal(requiresCard("card"), true)
  assert.equal(isSelectableLevel("card"), false)
  assert.equal(isSelectableLevel("open"), true)
  assert.equal(isSelectableLevel("verified"), true)
})

test("an unknown stored level falls back to the safe default, never to open", () => {
  assert.equal(asBookingAccessLevel("nonsense"), "verified")
  assert.equal(asBookingAccessLevel(""), "verified")
  assert.equal(asBookingAccessLevel("open"), "open")
})

test("a domain block accepts a whole address and keeps only the domain", () => {
  assert.equal(normalizeBlockValue("domain", "  Someone@Mailinator.COM "), "mailinator.com")
  assert.equal(normalizeBlockValue("domain", "MAILINATOR.com"), "mailinator.com")
  assert.equal(normalizeBlockValue("email", " Someone@Example.com "), "someone@example.com")
})

test("one booker is checked against their address, its domain and their IP", () => {
  assert.deepEqual(blockLookupsFor({ email: "A@Example.com", ip: "203.0.113.9" }), [
    { kind: "email", value: "a@example.com" },
    { kind: "domain", value: "example.com" },
    { kind: "ip", value: "203.0.113.9" },
  ])
})

test("no IP is not a match — local dev must still be able to book", () => {
  assert.deepEqual(blockLookupsFor({ email: "a@example.com", ip: null }), [
    { kind: "email", value: "a@example.com" },
    { kind: "domain", value: "example.com" },
  ])
})
