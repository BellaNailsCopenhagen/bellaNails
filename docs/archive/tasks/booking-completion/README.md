# Booking Completion — Agent Task Briefs

Self-contained, dependency-ordered task briefs for closing the client booking
loop (PLAN Phases 6–7). Each is one branch/PR. **Start with the context file.**

| # | Brief | What it delivers | Depends on |
|---|---|---|---|
| — | [`00-context.md`](./00-context.md) | Shared conventions, env, repo map, auth model, Clerk dashboard checklist. **Read first.** | — |
| 01 | [`01-step03-embed.md`](./01-step03-embed.md) | Step 03 · themed Cal.com embed; enables the confirm button; redirects to `/confirmation`. | — |
| 02 | [`02-webhook-identity.md`](./02-webhook-identity.md) | `/api/webhooks/cal` (persist `bookings`) + Clerk create-or-find/fill profile write. Backend only. | env/secrets |
| 03 | [`03-confirmation.md`](./03-confirmation.md) | `/confirmation` success page; recap via DB read; "create account" via prebuilt `<SignUp/>`. | 01, 02 |
| 04 | [`04-bookings.md`](./04-bookings.md) | `/bookings` auth-gated list; reschedule/cancel link-outs; server-rendered first. | 02 |

```
01 embed ─┐
          ├─▶ 03 confirmation
02 webhook┤
          └─▶ 04 bookings
```

Suggested execution: **01 → 02 → 03 → 04.** 01 and 02 can proceed in parallel
(different surfaces); 03 and 04 both need 02's data.

Design rationale lives in the owner's `booking-completion-spec.md`. Honor the
house rules in the context file — especially **preview diffs before writing
source**, and add i18n keys to both `da.json` and `en.json`.
