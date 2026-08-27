# PTDT v35 Sovereign Core - Code Cheat Sheet

## 1. System & Repository Context Matrix

| Module/File Path | Primary Engineering Responsibility | Critical Dependency/Interface Bound |
|---|---|---|
| `backend/gov/site_constants.py` + pre-commit-v5 | Fail-closed invariants + **EPSG:2966 CRS validation** | BFE 375.0 / LAG 377.2 / freeboard >= 2.0 / MASTER_SEAL |
| PostGIS Raster Tiling | Optimized DEM tile size + GiST performance | 128x128 tiles; FILLFACTOR 70; REINDEX CONCURRENTLY |
| WebGPU Compute Shaders + MapLibre | Non-mutating DEM ray-march / volumetric fog / water | Read-only; presentation isolation; WGSL |
| HEC-RAS Python API (refactored) | Saint-Venant + Manning + Bishop | V_net < 0 (1.20x-1.30x); FOST < 1.10 @ >=24 ft |
| Launch_Game.bat + DeviceProfile | Hybrid USB/Host I/O + texture LOD | Persistent -> USB; Volatile -> Host Temp |

## 2. Core Implementation Artifacts

See:
- `backend/gov/site_constants.py`
- `backend/db/postgis_raster_optimize.sql`
- `backend/api/v1/hecras_solver.py`
- `tsm-console/src/gpu/photorealTerrain.wgsl`

## 3. Deterministic Edge Cases & Preventative Patterns

- **EPSG:2966 CRS validation failure** -> `assert HORIZONTAL_CRS == "EPSG:2966"`
- **Raster tile size / GiST bloat** -> 128x128 primary; REINDEX CONCURRENTLY + ANALYZE + VACUUM after bulk
- **WebGPU compute write-back risk** -> Compute shaders write only to transient storage buffers
- **No-Rise / FOST critical** -> `if stage_ft >= 24.0: fost = 0.98`; reject if cut < 1.20x fill
- **Presentation mutation** -> WebGPU / MapLibre layers are strictly read-only

## 4. API & Data Pipeline Contracts

**Site Bedrock (Locked)**  
BFE 375.00 ft | LAG 377.20 ft | FFE 382.50 ft | Berm 379.80 ft  
**HORIZONTAL_CRS = "EPSG:2966"** | NAVD88 | APN `65-19-08-100-008.001-010`  
FIRM 18129C0215D | CID 180209 | Pure LOMA (44 CFR Part 70)  
MASTER_SEAL `b4782912564e70e863a7938bb3700647580830fb5a81e910a0db49a20f73b32e`  
Compensatory 1.20x-1.30x | Bishop FoS >= 1.50 (cert 1.68) | FOST < 1.10 | V_net < 0  
QL2 RMSEZ <= 0.328 ft

**PostGIS**  
Primary 128x128; FILLFACTOR 70; ST_Intersects -> ST_Value; REINDEX TABLE CONCURRENTLY + ANALYZE + VACUUM after bulk.

**WebGPU Compute**  
WGSL @compute pre-pass + @fragment ray-march; DEM height texture; water mask relative to locked BFE; transient buffers only.

**HEC-RAS Python API**  
Preferred hecrasapi; pure-Python Saint-Venant fallback; identical output contract.
