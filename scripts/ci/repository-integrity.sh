#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
required=(README.md LICENSE SECURITY.md COMPLIANCE.md .github/workflows/ci.yml integrations/registry/capabilities.json)
for path in "${required[@]}"; do
  [[ -f "$ROOT/$path" ]] || { echo "Repository integrity failure: missing $path" >&2; exit 1; }
done

echo "Repository integrity baseline passed."
