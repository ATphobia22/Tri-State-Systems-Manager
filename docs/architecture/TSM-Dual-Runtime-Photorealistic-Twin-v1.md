# TSM Dual-Runtime Photorealistic Twin Architecture

**Status:** Design alignment (not a claim of production photorealism)  
**Date:** 2026-09-25  
**Governance:** ADR-004 / ADR-005 — human authority final; Evidence plane authoritative

## Overview

Two runtime planes share one evidence-gated data fabric. Cinematic fidelity never outranks verified provenance.

```
[ Multi-Source Ingestion ]
  3DEP / LiDAR · Copernicus DEM (context only) · INFIP/BAFM · USGS/NOAA gages · NFHL
           │
[ Datum & spatial harmonization ]
  PROJ / EPSG:2966 · NAVD88 vertical · H3 · fail-closed gage-zero
           │
     ┌─────┴─────┐
     ▼           ▼
 Web plane    Cinematic plane
 MapLibre     Unreal / OpenUSD (optional)
 3D Tiles     Path tracing / PBR
 PMTiles      Procedural materials
     │           │
     └─────┬─────┘
           ▼
[ Evidence-gated pipeline ]
  SHA-256 · Merkle · engineering contract · BCA · agency eligibility
```

## Plane A — Web console (decision support)

| Layer | Stack | Rule |
|-------|--------|------|
| UI | React + TypeScript + Vite | Public visualization only |
| Map | MapLibre + Terrain-RGB | Regulatory overlays labeled as regulatory |
| 3D | Three.js / NASA-AMMOS 3d-tiles-renderer | SIMULATION_DEMO until sealed inputs |
| Tiles | PMTiles + Martin/PostGIS MVT | No credentials in client |
| Index | h3-js | Multi-resolution evidence cells |

## Plane B — Cinematic / engine (optional)

| Layer | Stack | Rule |
|-------|--------|------|
| Engine | Unreal path tracing / ray tracing | Offline or native installer plane |
| Materials | PBR from imagery + DEM breaks | Not survey truth |
| Interop | OpenUSD scene layers | Exchange only; not authority |

Plane B is **not** required for LOMA exhibits or INFIP/FARA packets.

## Hydrologic datum (non-negotiable)

WSE_NAVD88 = h_source + Z_gage_zero_validated

- No validated Z → do **not** publish WSE as NAVD88  
- Missing observation → SOURCE_UNAVAILABLE or STALE — never silent interpolate  

## Evidence-gated engineering order

1. Authoritative terrain (3DEP / sealed survey)  
2. Verified bathymetry / topobathy  
3. Datum control  
4. Baseline H&H (e.g. HEC-RAS) — labeled simulation until PE  
5. Alternative scenarios (dredge / cut-fill)  
6. Geotech / environmental screening  
7. BCA  
8. Agency eligibility / applications  
9. Human QA  

**Governance:** Meshes, dredge volumes, or fill cannot be tagged structural/regulatory without certified lab + agency path. TSM does not auto-file.

## Relation to LOMA / case 26-05-2022A

Photoreal twin work is **Plane 4 visualization**. LOMA additional-information items (deed, assessor map, PE/RLS elevations) remain **Plane 1 + human**. Rendering quality does not satisfy MT-1.

## Implementation hooks (repo)

- `tsm-console` — web plane  
- `ops/martin` — vector tiles  
- `scripts/validation/validate_panel_sha256.py` — panel/evidence hashes  
- `data/engineering/evidence-pipeline-contract.json` — gate schema  
- Native / Unreal docs under `docs/` and `native/` — cinematic plane  

## Explicit non-goals

- Treating Unreal frames as FEMA determinations  
- Auto-promoting AI segmentation without human review (ADR-006)  
- Fabricating bathymetry or gage-zero values  
