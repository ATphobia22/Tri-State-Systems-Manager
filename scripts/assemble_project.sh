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

cd "$CONSOLE"
if [ ! -d node_modules ]; then
  info "Installing dependencies..."
  npm install --no-audit --no-fund
fi

info "Running parse + typecheck gate..."
npm run check

info "Building production bundle (Vite)..."
npm run build

success "Assembly complete: $CONSOLE/dist"
