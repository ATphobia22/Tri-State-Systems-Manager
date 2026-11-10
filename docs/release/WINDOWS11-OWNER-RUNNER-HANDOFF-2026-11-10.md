# Windows 11 owner handoff — native UE5.8 Shipping

This is a **host setup and evidence-collection procedure**, not evidence of a successful packaged release. The Windows owner's authorized machine may act as the GitHub self-hosted runner if it has the licensed UE5.8 toolchain and approved local datasets.

## 1. Preserve local work and run read-only preflight

From a normal PowerShell window already in `C:\Tri-State-Systems-Manager`:

```powershell
git status --short
git remote -v
git rev-parse HEAD
git fetch origin main
# Do not run git reset --hard, git clean -fdx, or force-push; inspect local changes first.
.\scripts\native\Invoke-Windows11RunnerPreflight.ps1
```

The preflight prints each prerequisite, writes `dist/provenance/windows11-runner-preflight.json`, and intentionally exits nonzero when requirements are missing. **It does not install, sign, publish, or mutate the machine.** Share the report after reviewing it for machine paths. An installed Unreal version must be exactly 5.8; CesiumForUnreal's installed `VersionName` must equal `2.29.1`. PowerShell environment variable assignments only affect the current shell by default:

```powershell
$env:UE_ROOT = 'C:\Program Files\Epic Games\UE_5.8'
$env:TSM_NATIVE_DATA_ROOT = 'D:\TSMData-Snapshot'
$env:TSM_LOCAL_TILESET = 'buildings/tileset.json'
$env:TSM_SPATIALITE_DLL = 'C:\TSM-deps\mod_spatialite.dll'
.\scripts\native\Invoke-Windows11RunnerPreflight.ps1
```

These example paths are **not** assertions that files exist. `TSM_NATIVE_DATA_ROOT` must contain a complete, immutable snapshot and `data-manifest.json` with correct SHA-256 entries for every staged file, including actual local 3D Tiles payloads and licenses. `TSM_LOCAL_TILESET` should reference a tileset under that root. **Do not create a fake empty tileset, manifest, or DEM.**

## 2. Archive and restore large data through private Google Drive

Source snapshot destination: [TSM Native UE5.8 Input Snapshots](https://drive.google.com/drive/folders/1efwQlV1D3Aat4rhcmYPoo_kNtCRMNUt3). Release-output destination: [TSM Native UE5.8 Shipping Artifacts](https://drive.google.com/drive/folders/1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF).

Both folders were empty at the latest inspection. The existing [Verified Evidence](https://drive.google.com/drive/folders/1QvSnec14KQOcdz3-GpFx7dmmf_2YTAZf) folder contains analysis receipts, not a complete runtime snapshot. A historical repository ZIP is not a UE Shipping installer.

Once rclone has been configured securely and the full data snapshot has been placed into the dedicated input folder, use:

```powershell
$env:TSM_NATIVE_DATA_ROOT = 'D:\TSMData-Snapshot'
.\scripts\native\Restore-TSMDataFromDrive.ps1 -RemoteName 'tsm-drive:' -DataRoot $env:TSM_NATIVE_DATA_ROOT
```

Never commit a Drive access token or rclone configuration file to Git. Do not mix private data with publicly shared build artifacts. The restore verifies source file checksums; it does **not** certify NAVD88 or survey accuracy.

## 3. Register and validate a dedicated GitHub runner

Use the repository's [New self-hosted runner](https://github.com/ATphobia22/Tri-State-Systems-Manager/settings/actions/runners) page for a fresh token and its exact Windows x64 download and registration commands. Install under a separate directory such as `C:\actions-runner`, **not inside the repository or the installed UE directory**. Set labels `self-hosted,windows,x64,ue5`. Do not paste the registration token into a chat or issue. A runner must be online and available, with required repo variables `UE_ROOT`, `TSM_NATIVE_DATA_ROOT`, `TSM_LOCAL_TILESET`, `TSM_SPATIALITE_DLL`, and an authorized signing certificate available to the runner service account. Run `Validate-NativeRunner.ps1 -RunnerClass windows-ue5` on the machine.

The one-shot build request `[TSM-UE-PACKAGE]` produced [GitHub Actions run #42765030903](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/42765030903), but the `package-windows` job remained queued awaiting a matching runner at the audit. Do not trigger repeated packaging commits unnecessarily. Once a runner is online, inspect the run before requesting a new one.

## 4. Build and sign only after all gates pass

```powershell
.\scripts\native\Verify-NativeDataManifest.ps1 -DataRoot $env:TSM_NATIVE_DATA_ROOT -ManifestPath (Join-Path $env:TSM_NATIVE_DATA_ROOT 'data-manifest.json') -RejectExtraFiles
node scripts/native/stage-native-data-root.mjs
.\scripts\native\Build-TSMNativeWindows.ps1 -UnrealRoot $env:UE_ROOT
```

The UE5.8 editor creates `TSMNative.umap` from a **real local tileset**; BuildCookRun then builds/cooks/packages Win64 Shipping. Sign the resulting installer using the repository's configured certificate. Record SHA-256 of all produced binaries, exact Git SHA, toolchain version, the complete BuildCookRun transcript, SBOM, signing status, data manifest hash and geodetic evidence separately. On a standalone host, `$env:TSM_LOCAL_TILESET` must be supplied before calling the builder.

## 5. Clean Windows 11 offline acceptance

Test the resulting signed installer on a *different clean Windows 11 x64 environment*. Disconnect networking at the system/network-adapter level, install and start it, then capture headed screenshots/video showing HUD/menu actions, camera/navigation, local terrain tiles, buildings, missing-evidence display, FPS/VRAM/GPU and successful exit. Run `Test-OfflineWindows11Shipping.ps1` as elevated PowerShell to supplement the observations with process-start/failure evidence; its firewall-isolated smoke probe **is not sufficient** to certify clean-host or interactive rendering. Inspect the output `offline-smoke-evidence.json`.

**Release classifications:** source code passing tests; source data byte-integrity verified; static Win64 Shipping package verified; clean Windows 11 x64 offline runtime verified; regulatory/engineering validated. These are independent and must not be collapsed.

The two recovered Posey DEM TIFFs have EPSG:2968 horizontal CRS, while the project baseline is EPSG:2966; vertical datum/vertical units were not independently established. The 23,082-footprint identity reconciliation does not independently verify measured building heights. Until these checks are resolved, retain SOURCE_UNAVAILABLE/uncertainty labels for engineering elevations and avoid regulatory claims.
