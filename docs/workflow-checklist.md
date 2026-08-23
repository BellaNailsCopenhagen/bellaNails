# Workflow checklist — the progress contract

A long task loses its thread. `.claude/progress.md` is the one place that answers
"where are we?" — the statusline renders it live, `/progress` prints it in full.

**The rule: every non-trivial task keeps `.claude/progress.md` current, and every
reply that moves a stage shows the checklist.** Non-trivial = touches code, or
spans more than one tool call. A question or a one-line fix does not need it.

## The nine stages

| # | Stage | Done when |
| --- | --- | --- |
| 1 | Scope | The ask is restated in one line, `AGENTS.md` + [`docs/architecture.md`](architecture.md) re-read, unknowns listed. |
| 2 | Plan | Layer placement decided (`app → modules → db → platform`), files named, approach picked over the alternatives. |
| 3 | Build | Code written. |
| 4 | Verify | `npx tsc --noEmit && pnpm run lint && pnpm run build` — the real exit code, never grep-piped. |
| 5 | Self-review | `/code-review` run **and** every finding fixed, waived with a reason, or filed in [`docs/tasks/FOLLOWUPS.md`](tasks/FOLLOWUPS.md). |
| 6 | Your review | Handed off. **Blocked by design** — nothing commits before Raul has read it. |
| 7 | Address comments | Each comment answered with a change or a reason; verify re-run green. |
| 8 | Commit | Committed on a branch (never straight to `main`). |
| 9 | Merge | Merged into `main`. |

Stages 6 and 7 are the only ones that wait on a human. Stage 6 never advances on
its own — silence is not approval.

## The state file

`.claude/progress.md`, gitignored (live state, not history). One stage per line so
it stays readable raw and parseable by the statusline:

```
# <task title in one line>
branch: <git branch>
updated: <YYYY-MM-DD HH:MM>

- [x] 1 Scope — read AGENTS.md, catalog module mapped
- [x] 2 Plan — category CRUD in modules/catalog/category-actions.ts
- [>] 3 Build — 2/3 files done, category-select.tsx left
- [ ] 4 Verify
- [ ] 5 Self-review
- [ ] 6 Your review
- [ ] 7 Address comments
- [ ] 8 Commit
- [ ] 9 Merge
```

| Marker | Means |
| --- | --- |
| `[ ]` | todo |
| `[>]` | doing — **exactly one at a time** |
| `[x]` | done |
| `[!]` | blocked / waiting on Raul |
| `[-]` | skipped, with the reason in the note |

The note after `—` is the detail that makes the line worth reading: which file,
which command, what is left. Never a restatement of the stage name.

## Discipline

- Update the file **at the transition**, before starting the next stage — not in a
  batch at the end. A stale file is worse than none.
- A failing verify sends stage 4 back to `[ ]` and stage 3 back to `[>]`. Never
  mark `[x]` on something that was not actually checked.
- Hitting stage 6 or 7 means stopping and saying so — that is the point of the
  blocked marker.
- A new task resets the file. Finished work lives in git, not here.
