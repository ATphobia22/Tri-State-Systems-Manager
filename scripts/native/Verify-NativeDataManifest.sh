#!/usr/bin/env bash
set -euo pipefail
SCRIPT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_ROOT/native-data-manifest.mjs" verify \
  "${1:?usage: Verify-NativeDataManifest.sh <data-root> <manifest-json> [reject-extra]}" \
  "${2:?manifest-json is required}" "${3:-false}"
