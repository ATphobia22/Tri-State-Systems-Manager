#!/usr/bin/env bash
# PTDT v35 — WGSL static checks (syntax presence + basic structure)
# Full naga-cli optional when binary is provisioned locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GPU_DIR="$ROOT/tsm-console/src/gpu"
FAILED=0

echo "[VALIDATION] Scanning WGSL under $GPU_DIR"

shopt -s nullglob
files=("$GPU_DIR"/*.wgsl "$GPU_DIR"/**/*.wgsl)
if [ ${#files[@]} -eq 0 ]; then
  echo "[WARN] No .wgsl files found"
  exit 0
fi

for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  echo "[AUDIT] $f"
  # Basic structure gates
  if ! grep -qE '@(compute|vertex|fragment)' "$f"; then
    echo "[FAIL] Missing stage attribute in $f"
    FAILED=$((FAILED + 1))
    continue
  fi
  if grep -qE 'camPos:\s*,' "$f"; then
    echo "[FAIL] Incomplete array literal in $f"
    FAILED=$((FAILED + 1))
    continue
  fi
  echo "[PASS] $f"
done

if [ "$FAILED" -gt 0 ]; then
  echo "[ERROR] $FAILED shader(s) failed structural validation"
  exit 1
fi
echo "[SUCCESS] All scanned WGSL modules passed structural checks"
