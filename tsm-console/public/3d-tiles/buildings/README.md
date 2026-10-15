# Building 3D Tiles Directory

The 4,121 legacy GLB files have been archived to `../legacy/buildings-glb-legacy/`.

**Reason:** Their OBJECTIDs do not match the authoritative 22,815-building source
(only 25 of 4,121 overlap). They are not used by the production MapLibre application.

**Production data:**
- `../buildings-3d.json` — 22,815 features with height_m, source, achievedLod (validated)
- `../tileset.json` — root 3D Tiles wrapper (validated)
- `../buildings-lidar-12450/` — implicit tiling HLOD (validated)
- `../terrain-3dep/` — terrain tiles (validated)

This directory is retained for workflow compatibility.
