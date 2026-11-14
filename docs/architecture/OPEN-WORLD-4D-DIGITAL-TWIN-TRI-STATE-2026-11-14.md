# Open-World 4D Digital Twin — Tri-State River Valley (2026-11-14)

**Purpose:** Single architecture so the community can *see* an accurate open-world twin (terrain, roads, buildings, water, sky, weather, history, forecast) while engineering and grant work stay evidence-backed. Visualization never replaces FIRM/BAFL/survey.

## Counties in scope
Posey (IN), Vanderburgh, Gibson, Warrick · Gallatin (IL) · Union / Henderson (KY) as data allows. Anchor community: Mount Vernon / New Harmony / lower Wabash–Ohio confluence.

## Layer stack (bottom → top)

| # | Layer | Source / tech | Rule |
|---|--------|---------------|------|
| 1 | **Terrain** | USGS 3DEP 1 m + Indiana DEM; Terrain-RGB or quantized-mesh | NAVD88 provenance; no invented datum |
| 2 | **Imagery / basemap** | NAIP, state ortho, OSM | PMTiles / MapLibre |
| 3 | **Roads / hydro network** | TIGER, local GIS, NHD | Vector + labels |
| 4 | **Buildings LOD1–2** | Footprints + COPC roof heights → CityGML LOD2 → **glTF 2.0** in **3D Tiles 1.1** | Missing height = null, not default |
| 5 | **Water surface** | Gage stage (resilient USGS/NWPS) + static channel | Stage animated; labeled quality |
| 6 | **Flood history (4D)** | USGS peaks, 1913–2025 events, inundation SIR grids | Time slider; SIMULATION_DEMO until human-auth |
| 7 | **Forecast / climate** | NWPS, TimesFM screening, GEOGloWS | Screening only |
| 8 | **Sky / lighting / weather** | Procedural skydome, sun path, optional MRMS QPE | Cinematic path ACEScg |
| 9 | **Engineering tools** | Freeboard, no-rise, LOMA package, NLD overlay | Human authority final |
| 10 | **Grants / policy** | CCMG, IDEM 319, USDA, FEMA HMA links | Document, not auto-claim |

## CityGML LOD2 → glTF 2.0 → 3D Tiles

1. **Geometry:** RoofSurface + WallSurface + GroundSurface (CityGML LOD2).  
2. **Attributes:** optional; always carry `heightSource`, `quality` (OBSERVED|DERIVED|UNAVAILABLE).  
3. **Pipeline (OSS):** CityGML/CityJSON → (py3dtilers / tyler / 3DCityDB exporter) → **glTF 2.0 GLB** (KHR_mesh_quantization, meshopt, optional KTX2) → **3D Tiles 1.1** (implicit tiling preferred).  
4. **Client:** MapLibre + `3d-tiles-renderer` (or Cesium for globe) with `EXT_mesh_features` / structural metadata when present.  
5. **Clamping / ground:** Sample DEM under footprint; avoid global modelMatrix lift — prefer per-tile or GPU terrain flatten under buildings when z-fight.

## Open-world view (what you should see)

- Continuous terrain + draped roads  
- Cityscape as LOD2 shells (no fake windows)  
- Skydome + diurnal lighting  
- Water plane driven by live/stale stage  
- Historical flood extents as time-keyed overlays  
- Forecast ribbons as screening graphics  
- Bounding volumes / SSE for HLOD (UE5.8 / Cesium pin from #577 when merged)  
- VFX (spray, rain) only on cinematic plane — never on evidence rasters  

## 4D axis

- **t = observation time** for gages  
- **t = event** for historical floods  
- **t = forecast horizon** for NWPS/TimesFM  
- **t = construction / LOMC** for parcel evidence  

All time layers stay separate from geometry hashes.

## Grants (financial support path)

| Program | Fit |
|---------|-----|
| FEMA HMA / BRIC / FMA | Elevation, mitigation, mapping updates |
| IDNR / IDEM 319 | Watershed, nonpoint |
| CCMG / community grants | Local resilience projects |
| USDA | Rural infrastructure where eligible |
| USACE / state match | Levee, navigation context via NLD |

TSM role: **evidence package + maps** that support applications — not automatic grant approval.

## Implementation status vs ambition

| Capability | Status |
|------------|--------|
| MapLibre / Twin Canvas / 3D Tiles client | On main |
| 3DEP / NFHL / gages / H3 / PMTiles | On main |
| Resilient stage (jitter + breaker + LKG) | On main |
| Engineering packages + LOMA path | On main |
| Full county CityGML LOD2 tileset | **Generate** from footprints+COPC after #580/#581 |
| Skydome / weather VFX | Cinematic docs; implement in Twin/UE |
| Climate multi-decadal | Screening only; cite external models |

## Non-claims

Open-world beauty ≠ regulatory determination. Missing attributes stay missing. Human review remains final.
