# A/B Street evacuation modeling

Traffic microsimulation for evacuation/transport scenario modeling, built on
A/B Street (Apache-2.0, github.com/a-b-street/abstreet).

## Posture

A/B Street is a **build-time tool**, not a vendored dependency. Its Rust
workspace (`sim`, `map_model`, `raw_map`, `headless`, …) is too entangled to
vendor cleanly (git dependencies, deep internal crate graph), so the
reproducible path is:

1. `scripts/transport/build-abstreet-posey.sh` pins upstream, builds the
   `headless` scenario runner, and imports the Indiana OSM extract.
2. The **pre-built map binary** ships on the USB deployment image.
3. Evacuation scenarios run fully offline via `headless` + a scenario file.

The twin consumes scenario *outputs* (per-road volumes, evacuation times);
no A/B Street code links into the twin at runtime.

## Why it matters for TSM

Flood response is a transport problem as much as a water problem: which
roads stay passable at a given stage, how long evacuation takes from the
Bonebank anchor area, where contraflow helps. A/B Street's `sim` crate is a
genuine agent-based traffic microsim — real capability, not theater.

## Map import caveat

The default `import.sh` pulls OSM over the network. For air-gapped
reproducibility, the build script downloads the Geofabrik Indiana extract
**once** at build time; everything after that (import, scenario runs) is
offline. Re-run the script to refresh the extract.

## License

A/B Street is Apache-2.0. Pre-built map binaries derived from OpenStreetMap
data carry OSM's ODbL attribution requirement — keep the attribution file
with the shipped binary.
