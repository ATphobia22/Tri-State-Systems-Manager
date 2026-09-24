#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
violations=0

while IFS= read -r -d '' file; do
  if ! bash -n "$file"; then
    echo "SHELL SAFETY ERROR: syntax failure: $file" >&2
    violations=$((violations + 1))
  fi
  if grep -nE '(curl[^|\n]*\|[[:space:]]*(ba)?sh|wget[^|\n]*\|[[:space:]]*(ba)?sh|eval[[:space:]]+"?\$|source[[:space:]]+<(curl|wget)|git[[:space:]]+clone[^\n]*https?://[^[:space:]]+[^\n]*&&[[:space:]]*(bash|sh))' "$file" >/tmp/tsm-shell-unsafe.txt; then
    echo "SHELL SAFETY ERROR: remote/untrusted execution pattern in $file" >&2
    cat /tmp/tsm-shell-unsafe.txt >&2
    violations=$((violations + 1))
  fi
done < <(find "$ROOT/scripts" -type f -name '*.sh' -print0)

rm -f /tmp/tsm-shell-unsafe.txt

if (( violations > 0 )); then
  exit 1
fi

echo "Shell syntax and remote-execution safety checks passed."
