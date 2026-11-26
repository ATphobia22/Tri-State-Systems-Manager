# TSM Levels of Detail (All Layers)

**CRS:** EPSG:26916 · **Vertical:** NAVD88 · **BFE:** 369.1 ft NAVD88

## CityGML / 3DCityDB

| LoD | Content | TSM use |
|-----|---------|--------|
| 0 | Footprint / roof edge | Cadastral + floodplain overlay |
| 1 | Extruded solid | Default massing / clash screening |
| 2 | Roof structure | Regulatory / LOMA context preferred |
| 3 | Openings + façade detail | Public twin max (no interiors) |
| 4 | Interiors | Optional private; not public packages |

## 3D Tiles geometric error (m)

Region 500 · City 80 · District 20 · Block 5 · LoD1 2 · LoD2 0.5 · LoD3 0.15

## Height provenance

- OBSERVED — LiDAR/survey → may form 3D clash solids
- DERIVED — assessor/extrusion → visualization only
- INTERPOLATED/UNKNOWN — never regulatory elevation claims

## Unreal HLOD Data Layers

Terrain · Buildings_LoD1–3 · Roads · Utilities_Public · Flood_Overlays · Sim_SDF_Deltas

Cell: 128 m core / 512 m fringe. Public LoD cap = 3. Regulatory prefer LoD2.
