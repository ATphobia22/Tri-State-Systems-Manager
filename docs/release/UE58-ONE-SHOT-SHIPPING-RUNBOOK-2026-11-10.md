# UE5.8 Windows Shipping: one-shot dispatch and independent release evidence

**State at audit:** source commit `1cd1dcecf671a2457cade78a532bec3a93e84f79`; no independently verified UE Shipping executable or clean Windows 11 offline launch. This document does not certify a release.

## Operator-authorized one-shot request

The existing `.github/workflows/tsm-native.yml` remains manually dispatchable with `package_windows: true`. Because the connected GitHub action does not expose `workflow_dispatch`, the Windows packaging job also accepts a **main-branch push whose final commit message contains the exact token `[TSM-UE-PACKAGE]`**. The workflow's normal push path filters still apply. A plain commit, pull request, dependency bump, or untagged merge does not request Windows Shipping. This is a one-shot **request**, not proof that a runner accepted the job or that the package passed.

After reviewing and passing the PR's required checks, merge with commit title containing the exact marker. Review the resulting **TSM Native / package-windows** job at its immutable resulting main SHA. Do not merge other changes with this marker unless a build is intentionally requested. The label set is `[self-hosted, windows, x64, ue5]`; queueing cannot prove an online, authorized runner.

## Required runner configuration

`UE_ROOT` must resolve to an installed UE **5.8** engine containing RunUAT and UnrealEditor. Verify Cesium for Unreal **2.29.1**, MSVC, CMake, Ninja, Inno Setup, SignTool, SpatiaLite DLL, signed Windows certificate and timestamp service. Supply `TSM_NATIVE_DATA_ROOT` as an immutable, complete snapshot containing `data-manifest.json`; `Verify-NativeDataManifest.ps1 -RejectExtraFiles` must pass before staging.

Do not store service credentials or machine paths in Git. Google Drive serves as a human-controlled archive, not as a runtime dependency. Never require Google sign-in or cloud availability to start the released executable.

## Missing cooked map warning

On the audited source tree, `tsm-native/Content/` contains editor Python scripts but no checked-in `.umap`. `Config/DefaultEngine.ini` points at `/Engine/Maps/Templates/OpenWorld`, while `Config/DefaultGame.ini` points at `/Game/TSM/Maps/TSMNative`. Resolve these settings, generate the actual project-level map using UE5.8 editor tools, and ensure the map is present in the cooked output. Do not treat an engine template map as a verified Tri-State terrain scene.

## Acceptance and classification

1. **Build static evidence:** archive with genuine PE32+ AMD64 `TSMNative.exe`, cooked PAK or IoStore pair, packaged ArchimedesCore and SpatiaLite, UE5.8/Cesium version, exact checkout SHA, single successful BuildCookRun exit code, cryptographic hashes, valid Authenticode signer, SBOM and build provenance.
2. **Data evidence:** pinned manifest, actual complete local terrain/building/imagery tiles, source coverage counts, EPSG:2966/NAVD88 and geoid provenance, valid licenses; 23,082 building-object reconciliation remains independently gated by issue #416.
3. **Clean-host runtime evidence:** on a *separate clean Windows 11 x64 host* with networking disabled, record installation, first startup, native HUD/menu interaction, camera pan, terrain/3D-tile stream and recovery, offline asset loading, missing-evidence states, exit and uninstall. Capture headed screenshots/video plus CPU/GPU, FPS, VRAM, timestamps and package SHA.
4. **Scientific boundary:** simulated hydrology/flood design must not display default/demo values as regulatory observations; prohibit automated filings and assertions of survey-grade accuracy without sourced evidence and human approval.

Keep `STATIC_PACKAGE_VERIFIED_OFFLINE_LAUNCH_PENDING`, `CLEAN_HOST_OFFLINE_VERIFIED`, and `RELEASE_ACCEPTED` as separate classifications. Only independently recorded evidence can advance them.

## Oversized artifact storage

Store verified, distributable build archives and immutable SHA256SUMS outside Git. A dedicated Google Drive folder has been prepared: https://drive.google.com/drive/folders/1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF . Each upload should include a sidecar `.sha256`, source commit, artifact size, uploader/time, source licensing and release-gate status. Verify hash after download. Do not upload sensitive raw parcel or private survey data to a broadly shared folder.


## Google Drive binary-data handoff

Two separate **private** folders are intentionally used:

- Input snapshots: https://drive.google.com/drive/folders/1efwQlV1D3Aat4rhcmYPoo_kNtCRMNUt3
- Signed installers and provenance: https://drive.google.com/drive/folders/1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF

Put the complete immutable, licensed TSMData payload and its real `data-manifest.json` in the input folder. The optional Windows job step runs `Restore-TSMDataFromDrive.ps1` when `TSM_DATA_DRIVE_REMOTE` names a pre-authorized rclone Drive remote. It copies the files to the `TSM_NATIVE_DATA_ROOT` runner directory, then verifies every manifest-declared SHA-256 and rejects unexpected entries. The subsequent mandatory native data verification remains in place, whether or not Drive is configured.

Set `TSM_LOCAL_TILESET` to a **relative** path inside staged `Content/TSMData` (for example `buildings/tileset.json`) rather than the original Drive URL. A missing tileset or invalid root aborts map generation. The builder stages the ArchimedesCore and SpatiaLite native DLLs before generating the Unreal level; a real TSMNative.umap must be saved before BuildCookRun. Full terrain coverage and a camera-centred, geodetically correct scene still require headed acceptance.

When `TSM_DRIVE_REMOTE` names an rclone Drive remote, `Publish-TSMNativeToDrive.ps1` archives the signed installer, SBOM, BuildCookRun log and static evidence in a per-commit subfolder, and verifies source/destination hashes. Auth tokens must reside in protected runner configuration, never in Git or packaged assets. The destination remains private. If no remote is configured, artifacts remain available only through GitHub Actions; no Drive upload is claimed.

The November 9, 2026 source audit showed 23,082 matched footprint identities and exact geometry objects but **unverified measured heights**. Two Posey DEMs passed source checksums but had horizontal EPSG:2968 instead of project EPSG:2966, with **unverified vertical datum and vertical units**. Therefore neither the DEMs nor derived building attributes may be promoted to NAVD88 engineering proof without an independently reviewed transformation and provenance record.

A source-byte integrity PASS is not a geodesy PASS, and a UE Shipping build PASS is not a clean-host offline PASS.
