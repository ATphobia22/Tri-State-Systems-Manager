# PTDT v35 — Engineering Code Cheat Sheet

> **Purpose:** implementation navigation only. This document does not define FEMA, Indiana DNR, county, or other regulatory requirements.

## 1. System & Repository Context Matrix

| Module/File Path | Primary Engineering Responsibility | Critical Dependency / Interface Boundary |
|---|---|---|
| `backend/gov/site_constants.py` | Fail-closed project invariants and CRS validation | Source-bound elevation evidence; project configuration |
| `backend/db/postgis_raster_optimize.sql` | Raster storage and spatial-index performance | Database maintenance procedures |
| `tsm-console/src/gpu/photorealTerrain.wgsl` | Non-mutating terrain presentation | Visualization only; no evidence/model mutation |
| `backend/api/v1/hecras_solver.py` | Hydraulic/hydrologic computation bridge | Explicit scenario inputs; validation and uncertainty |
| `scripts/verify-backend-invariants.py` | Backend invariant/solver smoke checks | Run from repository root |

## 2. Core Implementation Artifacts

- `backend/gov/site_constants.py` — backend geodetic/project invariant checks
- `tsm-console/src/lib/firm-panel-ssot.ts` — FIRM panel identity and verification state
- `backend/db/postgis_raster_optimize.sql` — spatial storage/index maintenance
- `backend/api/v1/hecras_solver.py` — HEC-RAS bridge and solver calculations
- `tsm-console/src/gpu/photorealTerrain.wgsl` — WebGPU presentation layer

## 3. Deterministic Edge Cases & Preventative Patterns

- **CRS validation** → reject unexpected project CRS; do not relabel incorrectly tagged source data.
- **Raster performance** → use the configured tile/index strategy and perform database maintenance after bulk operations.
- **WebGPU write-back risk** → presentation shaders write only to transient/presentation buffers.
- **FEMA/Indiana no-rise analysis** → compare project-condition WSE against the applicable base-condition WSE. Do **not** substitute water stage minus BFE for project hydraulic rise.
- **Compensatory storage** → treat ratios such as 1.20× as explicit engineering/project inputs unless the applicable authoritative rule or permit establishes that value. The cited Posey subdivision provision uses an equal-volume cutting offset in its stated context.
- **Indiana thresholds** → keep FEMA 0.00-ft floodway no-rise, Indiana DNR's 0.14-ft cumulative-surcharge policy, and the 0.15-ft adverse-effect definition in 312 IAC 10-2-3 as separate authority layers.
- **Presentation mutation** → WebGPU / MapLibre layers are visualization-only and must not overwrite evidence/model state.

## 4. API & Data Pipeline Contracts

**Community Engineering Scope**

BFE | LAG | FFE | berm elevations: **SOURCE_REQUIRED**  
Horizontal CRS: **EPSG:2966** where the project analysis frame requires it; vertical datum remains separate metadata.  
Parcel/APN identifiers: **SOURCE_REQUIRED**  
FIRM/CID records: use the current SSOT/registry and preserve source verification state.  
Regulatory conclusions: **HUMAN_AUTHORITY_REQUIRED**

**Evidence integrity**

- SHA-256 is an integrity hash, not a digital signature.
- Server-side governance transition is required before authoritative Merkle append.
- Browser Merkle state is a non-authoritative cache/demo layer.
- Human authorization must remain explicit; TSM does not auto-file or issue FEMA/agency determinations.

## 5. Verification

```bash
cd tsm-console && npm run ci:full
cd .. && python scripts/verify-backend-invariants.py
```

## 6. Regulatory Source Discipline

Do not encode a numeric value as a universal legal requirement unless the applicable authoritative source establishes that value for the exact jurisdiction, project type, and pathway.

- FEMA LOMA evidence requirements are pathway-specific and must follow applicable MT-1 guidance/form instructions.
- A fill project is not automatically a pure LOMA pathway; determine the applicable LOMR-F/CLOMR-F process.
- Community Acknowledgment requirements are conditional by pathway and floodway/fill status.
- Professional certification/signature/seal remains a human responsibility.
- TSM calculations are decision support and evidence organization, not FEMA, DNR, county, surveyor, or engineer determinations.
