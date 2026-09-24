#!/usr/bin/env bash
# Tri-State Systems Manager — production console verification/package
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSOLE_DIR="${ROOT_DIR}/tsm-console"

if [[ ! -f "${CONSOLE_DIR}/package.json" || ! -f "${CONSOLE_DIR}/package-lock.json" ]]; then
  echo "ERROR: tsm-console package manifest or lockfile is missing."
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js 22+ is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required."; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 22 )); then
  echo "ERROR: Node.js 22+ is required; found $(node --version)."
  exit 1
fi

echo "======================================================================"
echo " TRI-STATE SYSTEMS MANAGER — PRODUCTION CONSOLE"
echo "======================================================================"

echo "[1/7] Installing locked dependencies..."
cd "${CONSOLE_DIR}"
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org

echo "[2/7] Repository integrity..."
npm run check:integrity

echo "[3/7] Site consistency..."
npm run check:site-consistency

echo "[4/7] Parse gate..."
npm run check:parse

echo "[5/7] TypeScript gate..."
npm run check:type

echo "[6/7] Tests..."
npm run test:all

echo "[7/7] Production Vite build..."
npm run build

test -f dist/index.html

echo
echo "Production artifact ready: ${CONSOLE_DIR}/dist/index.html"
echo "For GitHub Pages, enable the repository Pages source and set"
echo "GITHUB_PAGES_ENABLED=true as documented in docs/DEPLOYMENT.md."
echo "This script does not claim backend/API/PostGIS deployment."
