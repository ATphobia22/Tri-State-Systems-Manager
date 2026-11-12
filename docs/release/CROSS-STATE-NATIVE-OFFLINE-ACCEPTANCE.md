# Cross-state native release evidence and offline distribution

**Implementation date:** 2026-11-12. **Status:** source contracts and packaging integration; no claims that the full regional assets are available locally, that the UE5.8 self-hosted runner has run, or that the application is production certified.

## Why the geography is explicit

The existing engineering regional requirements include **eight counties** (Posey, Vanderburgh, Gibson and Warrick, IN; White and Gallatin, IL; Henderson and Union, KY). The community movie and six-county data research include **Posey, IN; Henderson and Union, KY; White, Wabash and Gallatin, IL**. Wabash, Illinois is not in the older eight-county manifest; three Indiana counties are not in the six-county scope. Their union is **nine** unique counties, not eight. A build **must choose one**: `community-six`, `engineering-eight` or `combined-nine`. See [the machine-readable policy](../../data/regional/native-county-scope-policy-v1.json).

## Authoritative sources, discovery not proof of acquisition

- Indiana: [Indiana GIO](https://gisdata.in.gov/) and USGS [3DEP](https://www.usgs.gov/3d-elevation-program/).
- Illinois: [Illinois Height Modernization Program / ISGS LiDAR clearinghouse](https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/). Download intersecting tiles for White, Wabash and Gallatin; do not assume an entire multi-hundred-GB county download fits a runner.
- Kentucky: [KyFromAbove Catalog Explorer](https://kygeonet.ky.gov/catalogexplorer/) and [KyFromAbove open cloud holdings](https://registry.opendata.aws/kyfromabove/). Select only intersecting tiles for Henderson and Union. EPSG:3089 by itself describes a **horizontal** grid, not the file's geoid or orthometric height datum.
- National backups: [USGS National Map](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download), FEMA USA Structures where licensing, vintage and coverage permit.

Save per-tile source URL, official ID, acquisition and retrieval dates, measured SHA-256, horizontal CRS, vertical datum, units, source geoid and scanned metadata. **Do not label a source EPSG:2968/NAD83(HARN) or a GEOID12B elevation as EPSG:2966/GEOID18 without a tested real transformation.** Even within NAVD88, a verified ECEF conversion needs the right geoid and compatible horizontal realization.

## Cross-state TSMData contract

Place a separately reviewed `regional-release-snapshot.json` inside the immutable `TSM_NATIVE_DATA_ROOT`, and list it among the SHA-256 files in `data-manifest.json`. Its schema must be `tsm.cross-state.release-snapshot.v1`, with an explicit `scope` and exactly that scope's FIPS keys.

Each county must include a **real** county polygon GeoJSON and SHA-256 hash, with its `GEOID` property and boundary authority. Under `assets`, register source-verified `terrain`, `imagery`, `buildings`, `roads`, and `hydrography` entries. Each asset supplies `path`, `sha256`, `kind`, `source_id`, `source_url`, `source_crs`, `acquired_at`, `retrieved_at`. Terrain GeoTIFFs additionally need `vertical_datum`, `vertical_units`, `geoid_model`, and a `vertical_evidence` file with measured SHA-256 and explicit `SOURCE_METADATA_REVIEWED` state. Vector/feature sources additionally require a hashed county-polygon `coverage_index` GeoJSON. These indexes constrain stated county membership; they **do not** establish feature completeness.

### Script usage

```powershell
# Run on the Windows GPU build host after restoring the independent data snapshot.
python -m pip show rasterio shapely pyproj
.\scripts\native\Assert-CrossStateReleaseData.ps1 `
  -DataRoot "D:\TSMData\snapshot" `
  -ManifestPath "D:\TSMData\snapshot\regional-release-snapshot.json" `
  -ReportPath "D:\TSMEvidence\release-cross-state.json" `
  -Scope community-six
```

This uses rasterio and PROJ to **read actual GeoTIFF extent/CRS**, transforms county boundaries and raster footprints into EPSG:5070 equal-area coordinates, and compares their union area with the exact county polygon. A 99% county footprint threshold is the default; input file hashes and vector county-index polygon intersection are also checked. **Bounds cannot prove every DEM pixel is non-nodata, hydro-flattened, current or vertically accurate.** Height source metadata review cannot replace independent datum transformation testing.

A failed or missing snapshot produces a blocker. Synthetic CI fixtures verify the algorithm but **are not county downloads**. The preflight receipt is generated outside TSMData and retained in the GitHub Actions evidence artifacts.

## Windows UE5.8 Shipping pipeline

The existing `TSM Native` workflow already stages a source snapshot, generates a real `.umap`, runs UE BuildCookRun Shipping, signs the cooked `TSMNative.exe` and `sde-graph.exe`, compiles the Inno Setup installer, and signs it. This change inserts a **required county-source preflight before staging**, and after signing runs `Assert-SignedReleaseArtifacts.ps1` to verify:

- exactly one each of native EXE, Rust SDE companion and Windows x64 installer;
- correct configured signer SHA-1 thumbprint, **Valid** Authenticode trust and a timestamp certificate;
- independent SignTool `verify /pa /all`, nonempty bytes and SHA-256 file inventory;
- resulting `tsm.native.signed-artifact-inventory.v1` receipt, explicitly marked **offline runtime pending**.

Upload the receipts with the installer. **No signing key is stored in Git.** The operator-provided signing identity must be installed on a protected UE5.8 Windows self-hosted runner. Metadata, code checks and static package verification are not a signed application artifact.

## End-to-end gates not satisfied by a passing pull request

1. Download only real, authorized source data intersecting all chosen counties; inspect source vertical/datum metadata and validity masks.
2. Complete GLB/3D Tiles/GeoTIFF/SpatiaLite source-to-UE imports, check georeferenced alignment and actor registration in the real `.umap`, including actual layer toggles and multi-county scene navigation.
3. UE5.8 Windows Shipping **must** build and cook on the authorized `self-hosted/windows/x64/ue5` runner with the exact Git SHA, source manifest and true Cesium plugin.
4. Verify **three signed binaries** and actual offline package.
5. On a physically air-gapped, clean Windows 11 x64 machine, install the signed release and run `scripts/native/Test-AirGappedWindows11Runtime.ps1` from the QA checkout with the installed `TSMNative.exe`, approved signer thumbprint and measured SHA-256. The script **refuses an active physical network adapter**, confirms Windows 11 and the signed binary, starts the actual process, captures a headed desktop PNG and an immutable JSON receipt, then requests graceful window close before falling back to forced termination. It makes no firewall or network configuration changes. Keep the resulting desktop screenshot private: it may expose unrelated application or personal information.
6. Independently record actual layer/menu interactions, verified terrain and 3D Tiles rendering, FPS/VRAM, source alignment, missing-evidence UI, clean-host history and normal exit. The headed smoke receipt explicitly marks these **not verified**; a screenshot alone is not acceptance.
6. A separate human reviewer evaluates geodetic, surveying and regulatory meaning. A byte hash or green CI is not permission for automated official findings.

At the November 12 check, an earlier one-shot [Windows Shipping workflow](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43227217501) still had `package-windows` queued; no authorized Desktop Commander device was connected. This document does not invent a completion date or signed binaries.
