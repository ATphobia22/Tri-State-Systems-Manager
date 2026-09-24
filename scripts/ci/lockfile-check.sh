#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCKFILE="$ROOT/tsm-console/package-lock.json"
[[ -f "$LOCKFILE" ]] || { echo "Missing npm lockfile: $LOCKFILE" >&2; exit 1; }

node - "$LOCKFILE" <<'NODE'
const fs = require('fs');
const lock = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const violations = [];
for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (typeof metadata?.resolved !== 'string') continue;
  try {
    const url = new URL(metadata.resolved);
    if (url.hostname !== 'registry.npmjs.org') violations.push(`${path}: ${metadata.resolved}`);
  } catch {
    violations.push(`${path}: invalid resolved URL ${metadata.resolved}`);
  }
}
if (violations.length) {
  console.error('Lockfile provenance violations:');
  violations.slice(0, 50).forEach((v) => console.error(v));
  process.exit(1);
}
console.log('npm lockfile provenance passed.');
NODE
