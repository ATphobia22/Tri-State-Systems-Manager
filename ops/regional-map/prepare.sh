#!/usr/bin/env bash
set -euo pipefail
# Run from this directory with three co-temporal Geofabrik state extracts.
[[ $# == 4 ]] || { echo "Usage: bash prepare.sh IN.pbf IL.pbf KY.pbf NEW_DATA_DIRECTORY" >&2; exit 2; }
out=$(realpath -m "$4")
[[ ! -e "$out" ]] || { echo "Choose a new output directory" >&2; exit 1; }
mkdir -p "$(dirname "$out")"
tmp=$(mktemp -d "$(dirname "$out")/.region.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
stamp=$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$1")
[[ -n "$stamp" ]] || { echo "Missing replication timestamp" >&2; exit 1; }
for input in "$2" "$3"; do
  [[ "$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$input")" == "$stamp" ]] || { echo "Replication timestamps differ" >&2; exit 1; }
done
sha256sum -- "$1" "$2" "$3" > "$tmp/inputs.sha256"
printf '%s\n' "$stamp" > "$tmp/osm-timestamp.txt"
osmium merge "$1" "$2" "$3" -o "$tmp/merged.osm.pbf"
osmium extract --bbox=-88.6,37.4,-87.0,38.6 --strategy=complete_ways "$tmp/merged.osm.pbf" -o "$tmp/region.osm.pbf"
rm "$tmp/merged.osm.pbf"
image=ghcr.io/project-osrm/osrm-backend:v5.27.1@sha256:b1ca5d72da456e82f81b8732a095c2357b00710099efa844040d1eb40b4b5386
run() { docker run --rm --network none --user "$(id -u):$(id -g)" -v "$tmp:/data" "$image" "$@"; }
run osrm-extract -p /opt/car.lua /data/region.osm.pbf
run osrm-partition /data/region.osrm
run osrm-customize /data/region.osrm
(cd "$tmp" && sha256sum region.* > routing.sha256)
mv -T --no-clobber "$tmp" "$out"
[[ ! -d "$tmp" ]]
