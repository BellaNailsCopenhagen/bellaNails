#!/usr/bin/env bash
# Renders .claude/progress.md as one line, so the stage is visible without asking.
IN=$(cat)
DIR=$(printf '%s' "$IN" | sed -n 's/.*"current_dir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$DIR" ] && [ -d "$DIR" ] || DIR=$PWD
ROOT=$(cd "$DIR" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null) || ROOT=$DIR

D=$'\033[2m'; C=$'\033[36m'; Y=$'\033[33m'; R=$'\033[31m'; G=$'\033[32m'; B=$'\033[1m'; Z=$'\033[0m'

BRANCH=$(cd "$ROOT" 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null)
printf '%s%s%s' "$D" "$(basename "$ROOT")" "$Z"
[ -n "$BRANCH" ] && printf ' %s⎇ %s%s' "$C" "$BRANCH" "$Z"

F=$ROOT/.claude/progress.md
[ -f "$F" ] || { printf '\n'; exit 0; }

awk -v EM="—" -v D="$D" -v Y="$Y" -v R="$R" -v G="$G" -v B="$B" -v Z="$Z" '
  /^- \[.\] / {
    m = substr($0, 4, 1); total++
    if (m == "x" || m == "-") done++
    if ((m == ">" || m == "!") && cur == "") {
      cur = $0; sub(/^- \[.\] [0-9]*[ ]*/, "", cur)
      p = index(cur, EM)                                   # note starts at the em dash
      if (p) { note = substr(cur, p + length(EM) + 1); cur = substr(cur, 1, p - 2) }
      gsub(/^[ \t]+|[ \t]+$/, "", cur); gsub(/^[ \t]+|[ \t]+$/, "", note)
      blocked = (m == "!")
    }
  }
  END {
    if (!total) { printf "\n"; exit }
    bar = ""
    for (i = 1; i <= total; i++) bar = bar (i <= done ? "▓" : "░")
    col = blocked ? R : (done == total ? G : Y)
    printf " %s│%s %s%s%s %s%d/%d%s", D, Z, col, bar, Z, D, done, total, Z
    if (cur != "") {
      printf " %s▸%s %s%s%s", D, Z, B col, cur, Z
      if (note != "") { if (length(note) > 44) note = substr(note, 1, 43) "…"; printf " %s· %s%s", D, note, Z }
      if (blocked) printf " %s⛔ needs you%s", R, Z
    } else if (done == total) printf " %s✓ all done%s", G, Z
    printf "\n"
  }
' "$F"
