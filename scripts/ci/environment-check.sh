#!/usr/bin/env bash
set -euo pipefail

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_command git
require_command node
require_command npm

node_version="$(node --version)"
npm_version="$(npm --version)"
case "$node_version" in
  v2[2-9].*|v[3-9][0-9].*) ;;
  *) echo "Node.js 22+ required; found $node_version" >&2; exit 1;;
esac

echo "Environment validated: node=$node_version npm=$npm_version"
