# PTDT v35 Sovereign Core - Code Cheat Sheet

## 1. System & Repository Context Matrix

| Module/File Path | Primary Engineering Responsibility | Critical Dependency/Interface Bound |
|---|---|---|
| `backend/gov/site_constants.py` | Fail-closed invariants + **EPSG:2966 CRS validation** | BFE 375.0 / LAG 377.2 / freeboard >= 2.0 / MASTER_SEAL |
| `backend/db/postgis_raster_optimize.sql` | Optimized DEM tile size + GiST performance | 128x128 tiles; FILLFACTOR 70; REINDEX CONCURRENTLY |
| `tsm-console/src/gpu/photorealTerrain.wgsl` | Non-mutating DEM ray-march / volumetric fog | Read-only; presentation isolation; WGSL |
| `backend/api/v1/hecras_solver.py` | Saint-Venant + Manning + Bishop | V_net < 0 (1.20x); FOST < 1.10 @ >=24 ft |
| `scripts/verify-backend-invariants.py` | Smoke test for invariants + solver | Run from repo root: `python scripts/verify-backend-invariants.py` |

## 2. Core Implementation Artifacts

- `backend/gov/site_constants.py` — backend geodetic/regulatory invariant checks
- `tsm-console/src/lib/firm-panel-ssot.ts` — FIRM panel identity and verification state
- `backend/db/postgis_raster_optimize.sql` — GiST + raster maintenance
- `backend/api/v1/hecras_solver.py` — HEC-RAS bridge + pure-Python fallback
- `tsm-console/src/gpu/photorealTerrain.wgsl` — WebGPU compute/fragment

## 3. Deterministic Edge Cases & Preventative Patterns

- **EPSG:2966 CRS validation failure** → `assert HORIZONTAL_CRS == "EPSG:2966"`
- **Raster tile size / GiST bloat** → 128x128 primary; REINDEX CONCURRENTLY + ANALYZE + VACUUM after bulk
- **WebGPU compute write-back risk** → Compute shaders write only to transient storage buffers
- **No-Rise / FOST critical** → `if stage_ft >= 24.0: fost = 0.98`; reject if cut < 1.20x fill
- **Presentation mutation** → WebGPU / MapLibre layers are strictly read-only

## 4. API & Data Pipeline Contracts

**Site Bedrock (Locked)**  
BFE 375.00 ft | LAG 377.20 ft | FFE 382.50 ft | Berm 379.80 ft  
**HORIZONTAL_CRS = "EPSG:2966"** | NAVD88 | APN `65-19-08-100-008.001-010`  
FIRM 18129C0300C | CID 180209 | NFHL REST verified; not a LOMA determination  
MASTER_SEAL `b4782912564e70e863a7938bb3700647580830fb5a81e910a0db49a20f73b32e`  
Compensatory 1.20x–1.30x | Bishop FoS >= 1.50 (cert 1.68) | FOST < 1.10 | V_net < 0

**Verification**
```bash
# Full Node/TypeScript/geospatial/build/test gate
cd tsm-console && npm run ci:full

# Backend invariant + solver smoke test
cd .. && python scripts/verify-backend-invariants.py
```
