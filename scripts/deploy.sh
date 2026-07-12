#!/usr/bin/env bash
# Production deploy guard. `vercel --prod` uploads the WORKING TREE (not a git
# ref), so the only way to make the `deploy` branch the source of truth is to
# refuse to run from anywhere else — or with uncommitted changes present.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "deploy" ]]; then
  echo "✗ Production deploys run from 'deploy' only — you are on '$branch'." >&2
  echo "  git checkout deploy && git merge --ff-only <reviewed branch>" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Working tree is not clean — commit or stash first." >&2
  git status --short >&2
  exit 1
fi

echo "Deploying $(git rev-parse --short HEAD) from 'deploy'…"
pnpm dlx vercel --prod
