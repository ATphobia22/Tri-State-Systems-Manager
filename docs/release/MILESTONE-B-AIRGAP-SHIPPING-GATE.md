# Milestone B — Air-gapped UE5.8 Shipping gate

## Phase 1 — Real HLOD / topobathy (before Shipping claims)

| Domain | Rule |
|--------|------|
| Topobathy / 3DEP | Verticals via documented VDatum/GEOID18 path; not raw ellipsoid as NAVD88 |
| HEC-RAS 2D HDF5 | Read-only WSE/velocity layers; no independent calibration claim |
| Buildings (23,082 footprints) | Match lidar; **null** heights stay null; UncertaintyLens visible |

Staging stub `tiles/posey_county_offline` is **DERIVED_STAGING** until real GLB/HLOD replace it.

ECEF gate: `python scripts/geospatial/tsm_ecef_validator.py`

## Phase 2 — Build on the authorized Windows runner

Run [TSM Native](../../.github/workflows/tsm-native.yml) with `package_windows: true` at the reviewed commit. The workflow checks the engine and Cesium versions, verifies and stages the immutable TSMData snapshot, authors the native map, cooks the project, and signs the Unreal executables and evidence companion before compiling Setup.

The package root is `dist/tsm-native/Windows`. Keep `TSMNative.exe` at that root together with the `Engine`, `TSMNative`, and `Tools` directories. The Shipping game lives under `TSMNative/Binaries/Win64`. Inno Setup embeds the package root and runs its signed prerequisite bundle before installation. The static evidence report checks both PE executables, loose runtime DLLs, cooked content and the packaged TSMData manifest.

## Phase 3 — Install and launch offline

1. On a clean Windows 11 x64 host, record the host image and GPU, disconnect networking, and copy in the signed Setup and its receipts. Verify Setup's SHA-256 and approved signer before running it.
2. Run Setup with installation logging enabled, for example `/LOG="C:\TSMReceipts\setup.log"`. Verify that the Start menu shortcut starts the installed launcher while offline. Record prerequisite or DLL errors from this first launch.
3. Open the terrain and building views, exercise layer and camera controls, and check the source status shown when an optional input is missing. Capture headed screenshots and GPU/FPS/VRAM evidence.
4. Run the process smoke test from an elevated PowerShell with the installation directory as the package root. It independently checks the Shipping process with executable firewall rules.

```powershell
.\scripts\native\Test-OfflineWindows11Shipping.ps1 `
  -PackageRoot "$env:ProgramFiles\Tri-State Systems Manager" `
  -EvidenceDirectory "C:\TSMReceipts\offline-smoke"
```

Attach the install log, smoke receipt, headed evidence, installed executable hashes, and source commit to the release review. The reviewer records clean-host acceptance independently of the automated process smoke result.
