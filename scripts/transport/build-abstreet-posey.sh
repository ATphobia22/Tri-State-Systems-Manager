#!/usr/bin/env bash
#
# Build the A/B Street headless evacuation scenario runner and import a
# Posey County road network, producing a pre-built map binary for USB deploy.
#
# A/B Street (Apache-2.0, github.com/a-b-street/abstreet) is used as a
# build-time tool only: its Rust workspace is too entangled to vendor, so this
# script pins upstream, builds the artifacts, and ships the OUTPUTS
# (pre-built map binary + scenario results) on the deployment image.
# The twin never links A/B Street code at runtime.
#
# Requirements: cargo (Rust stable), network access at BUILD time only.
# Usage: ./build-abstreet-posey.sh [--dev] [workdir]
set -euo pipefail

SPEED="--release"
if [[ "${1:-}" == "--dev" ]]; then SPEED=""; shift; fi
WORKDIR="${1:-$HOME/workspace/abstreet-build}"

ABSTREET_REF="${ABSTREET_REF:-master}"   # pin to a tag/SHA for reproducibility
OSM_URL="${OSM_URL:-https://download.geofabrik.de/north-america/us/indiana-latest.osm.pbf}"

echo "==> workdir: $WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

if [[ ! -d abstreet ]]; then
  echo "==> cloning A/B Street ($ABSTREET_REF)"
  git clone --depth 1 --branch "$ABSTREET_REF" https://github.com/a-b-street/abstreet.git 2>/dev/null \
    || git clone --depth 1 https://github.com/a-b-street/abstreet.git
fi
cd abstreet

echo "==> fetching Indiana OSM extract"
mkdir -p data/input
if [[ ! -f data/input/indiana.osm.pbf ]]; then
  curl -L -o data/input/indiana.osm.pbf "$OSM_URL"
fi

echo "==> importing road network (this takes a while)"
# import.sh wraps: cargo run --bin cli $SPEED --features importer/scenarios -- import
./import.sh $SPEED -- --input=data/input/indiana.osm.pbf 2>&1 | tail -5 || true

echo "==> building headless scenario runner"
cargo build --bin headless $SPEED

echo "==> done. Artifacts:"
echo "    map binary : $WORKDIR/abstreet/data/system/maps/"
echo "    headless   : $WORKDIR/abstreet/target/release/headless"
echo ""
echo "Copy the Posey County map binary into the USB deployment image and"
echo "invoke 'headless' with a scenario file to run evacuation modeling offline."
