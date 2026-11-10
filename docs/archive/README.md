# Archived docs

Completed, superseded, or stale documents moved out of the live `docs/` tree so a
new reader can go `README → SETUP → architecture → PLAN` without hitting stale
task history. Nothing is deleted — git history keeps everything.

## What was archived and why

| Source | Moved to | Reason |
|--------|----------|--------|
| `PROJECT_BIBLE.md` | `docs/archive/PROJECT_BIBLE.md` | Explicitly a **June-2026 snapshot**, marked stale beyond the storage row. Clerk and Cal.com are retired. Use `AGENTS.md` + `docs/architecture.md` as current. |
| `docs/PLAN.md` | `docs/archive/PLAN.md` | Historical build plan. Its own banner says paths predate the Aug 2026 `app → modules → db → platform` restructure and the vendors it names (Clerk, Cal.com, Scaleway) are retired. |
| `docs/DEPLOY-TEST.md` | `docs/archive/DEPLOY-TEST.md` | Test-phase Vercel CLI runbook where Cal.com is the source of truth for bookings — booking is now in-house. |
| `docs/tasks/*` | `docs/archive/tasks/*` | Completed per-feature task docs (context, PLAN, PROMPT, follow-ups, etc.) for admin, booking-completion, design-requests, explorations, in-house, QA, service-detail, terms-and-media. |

## Live docs (start here)

- `AGENTS.md` — the four-layer architecture and the eight lint rules
- `docs/architecture.md` — full architecture reference, conventions, where code goes
- `docs/SETUP.md` — from-zero developer setup runbook
- `docs/INFRASTRUCTURE.md` — vendor wiring, env vars, schema, auth gotchas
- `docs/product-review.md` — PM pass: what's built, what's worth it, what's next
- `docs/seo-plan.md` — local SEO plan for Ørestad / Bella Kvarter
- `docs/workflow-checklist.md` — the nine-stage progress contract (`.claude/progress.md`)
- `README.md` — project README and getting started
