# terrain_3dep — published Terrain-RGB tile pyramid (GitHub Pages)

**Current inventory:** 478 Mapbox Terrain-RGB PNG tiles, 256 px, covering
zoom levels **z8–z12**, with approximately **28.37 MB** of committed PNG
content, plus `tiles.json`.

Published tile template:

```text
https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png
```

The inventory is generated from the current committed tile tree; do not
describe the product using the retired 28-tile / z11–z15 screening inventory.

**Provenance.** Derived from the TSM 3DEP terrain pipeline. The Terrain-RGB
product is a screening/visualization derivative, not survey-grade elevation
evidence and is not a substitute for project-specific vertical control.
Vertical-datum claims remain bounded by the validated source metadata. Full
pipeline: `docs/TERRAIN-RGB-3DEP-PIPELINE.md`; evidence ledger:
`artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json`.

**Build contract.** Generate the pyramid with the repository terrain build
scripts and replace the directory as a complete artifact. Never hand-edit
individual PNG tiles. CI must validate the tile inventory, `tiles.json`,
encoding, and SHA-256 manifest before publication.
