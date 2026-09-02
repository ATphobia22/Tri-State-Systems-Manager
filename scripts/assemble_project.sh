#!/usr/bin/env bash
# PTDT v35 — Workspace assembly (tsm-console Vite path)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONSOLE="$ROOT/tsm-console"
LOG="$ROOT/assembly_run.log"

info()  { echo "[INFO] $*" | tee -a "$LOG"; }
error() { echo "[ERROR] $*" | tee -a "$LOG"; exit 1; }
success(){ echo "[SUCCESS] $*" | tee -a "$LOG"; }

: > "$LOG"
info "Verifying Node.js..."
command -v node >/dev/null || error "Node.js missing"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  error "Node.js >=22 required; found $(node --version)"
fi

cd "$CONSOLE"
if [ ! -d node_modules ]; then
  info "Installing locked dependencies..."
  npm ci --no-audit --no-fund
fi

info "Running full repository CI gate..."
npm run ci

success "Assembly complete: $CONSOLE/dist"
