# Native world review snapshot

The offline review snapshot combines the committed USGS 3DEP-derived terrain subset with the source-linked Posey County building preview. It includes terrain and building 3D Tiles, Posey footprint outlines for buildings without preview meshes, and the native SHA-256 data manifest.

| Layer | Included evidence |
| --- | --- |
| Terrain | 28 mesh payloads with the original source metadata and checksums |
| Posey buildings | 861 building mesh payloads containing 20,517 unique IGIO source OBJECTIDs |
| Footprint-only buildings | 2,565 additional IGIO OBJECTIDs with geometry and no preview mesh |

The building layer uses the same GEOID18 display adjustment as the Cesium preview. The receipt in `world-review.json` classifies this as visualization data. Eight-county completeness, surveyed alignment, roads, bathymetry, hydraulic validation, and headed Windows Shipping acceptance require separate evidence.

## Reproduce the snapshot

Use Node.js 22 and Python 3.12 from the repository root. The staging script verifies the published footprint archive against its pinned SHA-256, verifies building identity and tile geometry through the existing Cesium staging path, audits reachable local 3D Tiles references, and generates and verifies the native data manifest.

```sh
python -m pip install 'numpy==2.1.3' 'pyproj==3.8.0'
curl --fail --location \
  'https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/igio-posey-20261006/posey-buildings-igio-23082.geojson' \
  --output posey-footprints.geojson
python scripts/native/stage_native_world_review.py \
  --footprints posey-footprints.geojson --output tsm-world-review
```

Once the footprint file is available, snapshot assembly and byte verification can run offline. The output directory must be new. The **Native world review snapshot** workflow also produces a portable archive for review.

## Open in the local Unreal Editor

On a configured UE5.8 Windows workstation, extract the snapshot into a directory outside the project and run the following commands from the repository root. Use a separate review checkout because native data staging replaces that checkout's `Content/TSMData`.

```powershell
$env:TSM_NATIVE_DATA_ROOT = 'D:\tsm-world-review'
$env:TSM_LOCAL_TILESET = 'buildings/tileset.json'
$env:TSM_LOCAL_TERRAIN_TILESET = 'terrain/tileset.json'
node scripts/native/stage-native-data-root.mjs
if ($LASTEXITCODE -ne 0) { throw 'World review staging failed.' }
.\scripts\native\Generate-TSMNativeMap.ps1 -UnrealRoot $env:UE_ROOT
```

The generator requires the configured Unreal and Cesium toolchain and the project's runtime dependencies. Open the generated `/Game/TSM/Maps/TSMNative` level in Unreal Editor for visual inspection. The snapshot is a review input for this level. Use an independently accepted release snapshot for the [Windows 11 Shipping process](WINDOWS11-OWNER-RUNNER-HANDOFF-2026-11-10.md).
