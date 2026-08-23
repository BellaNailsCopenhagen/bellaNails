---
description: Show the task checklist, or advance a stage
allowed-tools: Bash(cat:*), Bash(sed:*), Bash(date:*), Bash(git:*), Read, Write, Edit
---

The contract is `docs/workflow-checklist.md`. The state is `.claude/progress.md`.

Arguments: `$ARGUMENTS`

- **No arguments** — read `.claude/progress.md` and render it as a table (`#`,
  `Stage`, `Status`, `Note`) with ⬜ todo, 🔄 doing, ✅ done, ⛔ blocked, ➖ skipped.
  Then say, in one line, what happens next. If the file is missing, say there is no
  task being tracked and offer to start one.
- **A stage name or number** (`/progress 4`, `/progress verify`) — mark it `[>]`,
  mark everything before it `[x]`, refresh `updated:`, then render the table.
- **`reset <title>`** — start a fresh checklist for that task: all nine stages
  `[ ]`, stage 1 `[>]`, current branch in the header.
- **Anything else** — treat it as a note for the stage currently `[>]`.

Never invent a `[x]`. If a stage's work did not actually happen, it is not done.
