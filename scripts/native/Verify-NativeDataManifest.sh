#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?usage: Verify-NativeDataManifest.sh <data-root> <manifest-json> [reject-extra]}"
MANIFEST="${2:?usage: Verify-NativeDataManifest.sh <data-root> <manifest-json> [reject-extra]}"
REJECT_EXTRA="${3:-false}"
python3 - "$ROOT" "$MANIFEST" "$REJECT_EXTRA" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
if manifest.get('schemaVersion') != 1 or manifest.get('integrity') != 'sha256': raise SystemExit('Unsupported manifest')
expected = {}
for entry in manifest.get('files', []):
    path = entry['path']
    parts = pathlib.PurePosixPath(path).parts
    if pathlib.PurePosixPath(path).is_absolute() or '..' in parts: raise SystemExit(f'Unsafe manifest path: {path}')
    if path in expected: raise SystemExit(f'Duplicate manifest path: {path}')
    expected[path] = entry['sha256'].lower()
    file_path = root.joinpath(*parts)
    if not file_path.is_file(): raise SystemExit(f'Manifest file missing: {path}')
    if hashlib.sha256(file_path.read_bytes()).hexdigest() != expected[path]: raise SystemExit(f'SHA-256 mismatch: {path}')
    if file_path.stat().st_size != entry['sizeBytes']: raise SystemExit(f'Size mismatch: {path}')
if sys.argv[3].lower() == 'true':
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    extra = actual - set(expected)
    if extra: raise SystemExit('Unmanifested data files: ' + ', '.join(sorted(extra)))
print(f'Native data manifest verified: {len(expected)} files')
PY
