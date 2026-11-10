# Working prompt — QA remediation

Paste this into a fresh session in the repo root. It drives
[PLAN.md](PLAN.md) one item at a time.

---

You are working through `docs/tasks/qa-2026-09/PLAN.md`, a remediation list from a QA
pass over Bella Nails. Work it **one item at a time, in file order**, and do not start
the next item until the current one is merged.

## Before the first item

Read `AGENTS.md` and `docs/architecture.md` and hold to them: `app → modules → db →
platform`, never skipping or reversing. `.from("table")` only in `src/db/**`. A page asks
a module one question and renders; it never builds a client. A client component reaches a
mutation through `@/modules/<domain>/<x>-actions`, a rule through `@/shared/*`, a
reactive read through `@/db/*`, and a type through `import type`. This is not the Next.js
in your training data — read the relevant guide under `node_modules/next/dist/docs/`
before using an API you are unsure of.

Then read the whole plan once so you know what is coming, and confirm the working tree is
clean.

## The loop, per item

**1 · Understand before touching anything.** Read every file the item names, plus the
callers. Reproduce the bug — in the browser for a `[live]` item, or by tracing the exact
path for a `[code]` one. If you cannot reproduce it, say so and stop; a fix for a bug you
have not seen is a guess.

**2 · Branch.** `git checkout -b fix/qa-NN-short-slug` off an up-to-date `main`.

**3 · Propose, then write.** Show me the diff and wait for an OK before writing it. This
is a standing rule in this project, not a formality — I want to see the shape of a change
before it lands. If the fix turns out to need a product decision the plan didn't
anticipate, stop and ask instead of picking for me.

**4 · Fix the cause, not the symptom.** Prefer the change that makes the whole class of
bug impossible over the one that silences this instance. Where the plan says a rule is
enforced in one place out of two, add the second — don't remove the first. Keep the
change scoped to the item: if you spot something else, write it down at the bottom of
PLAN.md under a `## Found while fixing` heading and carry on.

**5 · Gate it.** Run the real thing and check the real exit code — never pipe the build
into grep:

```
npx tsc --noEmit && pnpm run lint && pnpm run build
```

pnpm via corepack, project-local. No global installs.

**6 · Verify by hand.** Walk the item's own **Verify** steps against the running app, and
re-walk the nearest neighbouring flow to check you didn't break it — a locale-toggle fix
gets the whole booking flow re-walked, an auth fix gets sign-in, sign-out and the admin
gate. Say what you actually observed, not what you expect.

**7 · Review the fix with fresh eyes.** Re-read your own diff as if someone else wrote
it, and answer these out loud before merging:

- Does it fix the reported cause, or move it?
- What breaks if the thing it depends on fails or is missing — does it fail safe, and
  does it *say* so? Several bugs in this plan are silent degradation.
- Does it hold for a caller that isn't the UI? Three items here exist because a rule
  lived only in a component.
- Any new string a user can see: is it in both catalogues, and does it say what actually
  happened and what to do?
- Any new query: right layer, right client, soft-delete filter, owner-gated if admin?
- Did the diff pick up anything unrelated — a stray import, a reformat, a `console.log`?

If the review turns something up, fix it on the same branch and re-run step 5.

**8 · Merge.** Conventional commit in this repo's voice — subject line says what changed
for the person using it, not which function moved. Then merge to `main` (no PR needed
unless I say otherwise), tick the item's checkbox in PLAN.md, and delete the branch.

**9 · Report and stop.** One short paragraph: what was wrong, what you changed, what you
verified, anything you deliberately left. Then move to the next item.

## Standing rules

- Never widen scope silently. New work goes in `## Found while fixing`, not into the
  current diff.
- Never edit `.env.local` values you were not asked to — QA-20 covers the formatting only.
- Do not apply SQL migrations. If an item needs one, write the file, say so, and leave it
  to me — `supabase/outside-hours.sql` in particular must never be run.
- Do not create test bookings against the live project without telling me first, and clean
  up what you create.
- If two items collide, finish the first, rebase the second, and note the interaction.

## When the list is done

Re-run the full gate on `main`, then post a summary: every item, what shipped, what is
still open, and everything that accumulated under `## Found while fixing`. Do not start on
the "Decisions to make" section or the "Not in this plan — yours" section — those are mine.
