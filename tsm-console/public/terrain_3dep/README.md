# terrain_3dep — published tile pyramid (GitHub Pages)

28 Mapbox Terrain-RGB PNGs (z11–z15, 256 px, 252 KB total) + `tiles.json`,
served by GitHub Pages at:

```text
https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png
```

**Provenance.** Derived from the 3DEP screening DEM
(`src/lib/flood-sim/world/data/surveyed-dem-posey.json`,
SHA-256 `3af2aea7…897d`) by `scripts/geospatial/build-terrain-rgb.sh`.
Screening-level, not survey-grade; NAVD88 as reported by the source, never
re-projected or certified. Full pipeline: `docs/TERRAIN-RGB-3DEP-PIPELINE.md`;
evidence ledger: `artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json`.

**Why committed.** The repo policy discourages generated tile pyramids, but
this 28-tile / 252 KB screening pyramid is the documented carve-out that lets
GitHub Pages serve the tiles with zero infrastructure (same carve-out as the
bundled DEM JSON). Regenerate with the build script after any DEM refresh and
replace this directory wholesale — never hand-edit a tile.
