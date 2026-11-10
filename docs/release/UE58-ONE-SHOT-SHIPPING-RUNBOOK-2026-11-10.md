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
