# EPSG:2966 · HEC-RAS · Cinematic/USD Plane

## EPSG:2966 (authoritative horizontal CRS)

| Property | Value |
|----------|--------|
| Name | NAD83 / Indiana West (ftUS) |
| Type | Projected CRS |
| Base | EPSG:4269 (NAD83) |
| Method | Transverse Mercator |
| Units | **US survey foot** |
| Origin lat | 37.5° |
| Central meridian | −87.0833333333333° |
| Scale | 0.999966667 |
| False easting | 900000 US ft |
| False northing | 249999.9998983998 US ft |
| Area | Includes **Posey County** |

**Reject EPSG:2967** (NAD83(HARN) / Indiana East ftUS) — wrong zone and datum flavor for Bonebank / Posey.

### Transform notes (WGS84 / MapLibre)

- MapLibre default view is Web Mercator (EPSG:3857) / WGS84 lon-lat for interaction.
- Authoritative analysis coordinates remain **2966 + NAVD88**.
- PROJ-style definition (approx.):  
  `+proj=tmerc +lat_0=37.5 +lon_0=-87.0833333333333 +k=0.999966667 +x_0=900000 +y_0=249999.9998984 +ellps=GRS80 +units=us-ft +no_defs`
- Prefer grid-based NAD83↔WGS84 (e.g. NADCON / `inhpgn`) when sub-meter accuracy matters; document transformation chain on every derived EvidenceArtifact.

**Vertical:** NAVD88 — never treat horizontal EPSG code as a vertical datum.

## HEC-RAS flood simulation → TSM

| Step | Output | TSM handling |
|------|--------|----------------|
| Terrain (IGIO DEM) | RAS Terrain | OBSERVATION / input hash |
| Unsteady 2D run | Depth, WSE, Velocity maps | MODEL_OUTPUT + model_version |
| Stored rasters | GeoTIFF at terrain resolution | SHA-256 → Evidence Ledger |
| Inundation boundary | Polygon from zero-depth contour | DERIVED |
| USGS/NWPS BC | Stage/flow time series | OBSERVATION (provisional flagged) |

Human gate before any regulatory use. Browser WebGPU/Three water meshes are **SIMULATION_DEMO**.

## Attached prototype integration

| Artifact | Plane | Rule |
|----------|-------|------|
| `Cinematic_Affidavit_Generator.py` | Visualization | Ported to `tools/cinematic_affidavit.py` with `authority_class=VISUALIZATION` |
| `PTDT_to_USD_SceneState_Generator.py` | Visualization | USD export is **DERIVED**; seal = parent model hash only |
| `Archimedes_Compute_Coupler.txt` (WGSL) | Scientific research | Labeled SIMULATION_DEMO — not HEC-RAS substitute |
| `R-Node_Subsystem_Implementation_Plan.md` | Ops | Fail-closed capability detect + SHA-256 lockfile pattern — aligns with Evidence workers |
| USD/WebGPU HTML demos | Visualization | Prototype only; production uses Vite + R3F/MapLibre |

## R-Node pattern (ops)

Reproducibility flow: pinned lock → SHA-256 verify → platform detect (no silent override) → environment manifest JSON → smoke tests.  
Maps to TSM ingestion: Authority Registry → health check → schema → hash → ledger.

