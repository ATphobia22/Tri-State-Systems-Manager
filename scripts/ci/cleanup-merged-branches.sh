#!/usr/bin/env bash
# Local / operator branch cleanup for Tri-State-Systems-Manager
# Requires: gh auth login  (or GH_TOKEN)
set -euo pipefail

REPO="${REPO:-ATphobia22/Tri-State-Systems-Manager}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

echo "=== TSM branch cleanup: $REPO (keep $DEFAULT_BRANCH) ==="

git fetch --prune origin 2>/dev/null || true

git branch --merged "$DEFAULT_BRANCH" | grep -vE "^\*|${DEFAULT_BRANCH}" | while read -r b; do
  echo "DELETE local merged: $b"
  git branch -d "$b" || true
done

if command -v gh >/dev/null 2>&1; then
  gh api "repos/${REPO}/pulls?state=closed&per_page=50" --jq '.[] | select(.merged_at != null) | .head.ref' \
    | sort -u \
    | while read -r branch; do
        case "$branch" in
          "$DEFAULT_BRANCH"|master) continue ;;
          dependabot/*|renovate/*)
            echo "DELETE origin/$branch"
            gh api -X DELETE "repos/${REPO}/git/refs/heads/${branch}" 2>/dev/null \
              || echo "  (gone)"
            ;;
        esac
      done
else
  echo "gh CLI not installed — only local prune performed."
  echo "Enable: Settings → General → Pull Requests → Automatically delete head branches"
fi

echo "=== Remaining remote branches ==="
git branch -r
