# Milestone B — Air-gapped UE5.8 Shipping gate

## Phase 1 — Real HLOD / topobathy (before Shipping claims)

| Domain | Rule |
|--------|------|
| Topobathy / 3DEP | Verticals via documented VDatum/GEOID18 path; not raw ellipsoid as NAVD88 |
| HEC-RAS 2D HDF5 | Read-only WSE/velocity layers; no independent calibration claim |
| Buildings (23,082 footprints) | Match lidar; **null** heights stay null; UncertaintyLens visible |

Staging stub `tiles/posey_county_offline` is **DERIVED_STAGING** until real GLB/HLOD replace it.

ECEF gate: `python scripts/geospatial/tsm_ecef_validator.py`

## Phase 2 — BuildCookRun (authorized Windows runner)

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun `
  -project="C:\TSM\TriStateSystemsManager.uproject" `
  -noP4 -platform=Win64 -clientconfig=Shipping -serverconfig=Shipping `
  -cook -allmaps -build -stage -pak -archive `
  -archivedirectory="C:\TSM\Binaries\Win64\ShippingOutput"
```

Adjust `-project` path to the actual `.uproject` on the runner.

## Phase 2 — Offline acceptance

```powershell
.\scripts\native\Test-TSMShippingRuntime.ps1 `
  -ExecutablePath "C:\TSM\Binaries\Win64\TriStateSystemsManager.exe" `
  -StagedAssetsDir "C:\TSM\Binaries\Win64\Content\Tiles\posey_county_offline" `
  -RequireAirGap
```

- Network adapters down for strict air-gap
- Cesium loads **local** `tileset.json` / `.glb` only
- No Ion token / 401 patterns in logs
- Optional: headed screenshots + binary SHA-256 vs release manifest

Human authority remains final.
