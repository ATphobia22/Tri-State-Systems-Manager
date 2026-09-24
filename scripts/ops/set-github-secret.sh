#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <OWNER/REPO> <SECRET_NAME> [VALUE_FILE]" >&2
  echo "Reads the secret from VALUE_FILE, or stdin when omitted." >&2
  exit 2
}

[[ $# -ge 2 && $# -le 3 ]] || usage
repo="$1"
name="$2"
[[ "$name" =~ ^[A-Za-z0-9_]+$ ]] || { echo "Invalid secret name." >&2; exit 2; }
[[ "$name" != GITHUB_* ]] || { echo "Secret names must not use the GITHUB_ prefix." >&2; exit 2; }

if [[ $# -eq 3 ]]; then
  [[ -f "$3" ]] || { echo "Secret value file does not exist." >&2; exit 2; }
  gh secret set "$name" --repo "$repo" < "$3"
else
  gh secret set "$name" --repo "$repo"
fi

echo "Secret metadata updated: $repo / $name"
