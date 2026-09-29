# TSM V45 Offline Build Pipeline — Architecture Record

**Status:** target architecture (2026-09-29). This document records the owner's
V45 vision: one operational runtime with specialized supporting toolchains,
fully local-first and air-gapped.

**Honesty note:** parts of this stack cannot be built or executed in a Linux
CI/VM environment (no Unreal Engine, no GPU, no Windows). Items marked
`[scaffold]` are documented interfaces and descriptors only — they require
Unreal Engine 5.8+ on Windows to compile and are not built or tested here.
Items marked `[implemented]` exist and are verified in this repo.

---

## 1. Goal: one operational runtime

```text
ONE OPERATIONAL RUNTIME

UNREAL ENGINE 5              [scaffold — tsm-native/, UE 5.8 module]
        +
POSTGIS + H3                 [implemented — SQL schemas; PostGIS runs on operator infra]
        +
HEC-RAS                      [pattern: parse vendor HDF5 outputs offline; no binaries here]
        +
MODFLOW                      [pattern: same offline-parse posture as HEC-RAS]
        +
SWMM                         [pattern: same offline-parse posture as HEC-RAS]

Blender / Houdini / Natron / Avid / Apple MapKit
        become supporting toolchains (not available in this environment)
```

## 2. System topology

```text
                TSM SOURCE FABRIC            [implemented — data/, SHA-256 manifests]

  LiDAR      FEMA      NOAA      USGS      Parcels
    │           │         │         │          │
    └───────────┴─────────┴─────────┴──────────┘
                          ↓
                  DATA INGESTION BUS         [implemented — scripts/geospatial/, ogr2ogr]
                          ↓
                   POSTGIS + H3              [implemented — ops/postgis/migrations/]
                          ↓
                 TSM EVIDENCE LEDGER         [implemented — Merkle-chained manifests]
                          ↓
          HEC-RAS | MODFLOW | SWMM           [offline-parse pattern; staging.ras_cells]
                          ↓
                SIMULATION SNAPSHOTS        [implemented — data/scenarios/]
                          ↓
                 UNREAL ENGINE 5             [scaffold]
                          ↓
              OPERATIONAL DIGITAL TWIN
                          ↓
      Blender | Houdini | Natron | Avid      [supporting toolchains; docs only]
```

## 3. Offline build pipeline stages

### Stage 1 — Source acquisition (USB / DVD / offline NAS / offline tile archives)

Sources: USGS 3DEP, FEMA NFHL, IndianaMap, County GIS, NOAA, USACE.
No internet required. Every acquisition lands with a SHA-256 manifest
(`data/posey-county/README.md` pattern).

### Stage 2 — Evidence validation

SHA-256 → Merkle chain → timestamp → dataset registry.
Output: the Merkle-chained evidence registry (restricted plane).

### Stage 3 — Terrain processing (PDAL)

```text
LAS → classify ground → DEM → terrain tiles → GeoTIFF / COG / Terrain-RGB
```

Deterministic quantized terrain ships in-repo
(`tsm-console/src/lib/quantized-grid.ts`, uint16, max round-trip error
≈ 2.7e-4 ft). Screening-level: never survey or regulatory evidence.

### Stage 4 — Spatial fabric (PostgreSQL + PostGIS)

Stores: parcels, floodplains, buildings, roads, LiDAR, telemetry,
infrastructure. H3 indexes the fabric (`h3-spatial-fabric` in the console).
Migrations live in `ops/postgis/migrations/` — including the multiphysics
staging schema (`staging.ras_cells`: normalized HEC-RAS hydraulic state,
explicitly *not* a regulatory determination).

### Stage 5 — Engineering engines

| Engine | Role | Outputs |
|---|---|---|
| HEC-RAS | flood modeling: depth, velocity, WSE | `simulation_snapshots` |
| MODFLOW | groundwater, aquifer, seepage | `simulation_snapshots` |
| SWMM | stormwater, drainage, urban hydrology | `simulation_snapshots` |

Execution posture: vendor binaries run on operator Windows workstations;
this repo stages and verifies their *outputs* offline (see
`scripts/windows/Ingest-TSMDataFabric.ps1`, which refuses synthetic
fallbacks and requires an operator-approved parser).

## 4. Unreal plugin architecture `[scaffold]`

Target layout under `tsm-native/Plugins/` (descriptors + pure-C++ interfaces;
requires UE 5.8+ on Windows to compile):

```text
Plugins/
├── TSMCore            Runtime framework, DI, config, health      → ITsmModule/ITsmService/ITsmRuntime
├── TSMGIS             Terrain/tiles/buildings/parcels            → PMTiles, GeoTIFF, Terrain-RGB, vector tiles
├── TSMHydrology       HEC-RAS/MODFLOW/SWMM integration           → depth, velocity, WSE, flow → flood surfaces
├── TSMInfrastructure  Roads, levees, bridges                     → from TSMEngineeringDesignFabric
├── TSMEvidence        Hashing, attestation, ledger               → frame/scenario/snapshot hashes
├── TSMH3              H3 spatial indexing                        → from TSMOfflineTileset
├── TSMTelemetry       Live/fused sensor state                    → gauge/telemetry feeds
├── TSMRegulatory      FIRM/FIS/LOMA overlays                     → from TSMEvidenceFabric
├── TSMTimeMachine     Historical replay / forecast               → 1913, 1943, 2011, current, 100-yr, 500-yr
└── TSMCinematics      Sequencer, evidence compositing            → from TSMCinematicFabric
```

Existing single-module content maps onto these plugins (see §1 statuses).
The current `tsm-native/Source/TSMNative/` module remains the compilable
core; `Plugins/` is the forward topology.

## 5. Supporting toolchains (docs only in this environment)

- **Blender** — asset authoring (buildings, bridges, levees, signs).
  Export USD/FBX/glTF → imported into Unreal.
- **Houdini** — procedural engineering (floodplains, river channels, levees,
  terrain repair, road corridors). LiDAR → Houdini → USD → Unreal.
- **Natron** — evidence compositing (regulatory/grant videos, flood
  comparisons, historical overlays) from Unreal renders + evidence metadata.
- **Avid** — final production (public meetings, grant presentations,
  engineering reviews, training). Unreal → EXR → Natron → Avid.
- **Apple MapKit** — reference basemap/routing/geocoding/search ONLY.
  Never authoritative elevation. Authoritative layers (USGS 3DEP, FEMA,
  parcels, LiDAR, HEC-RAS) stay in PostGIS, not Apple. (On non-Apple
  targets the repo uses CesiumForUnreal + MapLibre for the same role.)

Mapping layer stack:

```text
Apple MapKit (or Cesium/MapLibre)  →  context
MapLibre vector tiles               →  transport overlays
PostGIS                             →  authoritative data
HEC-RAS                             →  flood layers
Unreal Engine 5                     →  3D digital twin
```

## 6. Runtime frame

Terrain, buildings, roads, levees, hydrology, weather, telemetry, risk,
infrastructure, compliance — all rendered inside Unreal Engine 5 with
Nanite, Lumen, World Partition, virtual texturing, and the PCG framework.

## 7. What this environment verifies

- PostGIS migrations: authored as idempotent SQL, reviewed here, executed
  on operator/Postgres infra (none on this VM).
- Native physics (`native/archimedes/`): compiled and tested here
  (cmake/g++ present).
- UE C++: reviewed for API correctness; not compiled here (no engine).
- Ingest scripts: `bash -n` / `node --check` here; PowerShell scripts are
  Windows-only and reviewed statically.
- Evidence manifests, quantized terrain, SPA, desktop apps: built and
  verified here (see `tsm-console/desktop/README.md`).
