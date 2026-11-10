# Native UE5.8 Windows Shipping — execution and signing evidence

## Scope

This patch fixes two independent release defects:

1. A deliberately authorized `[TSM-UE-PACKAGE]` push (or `workflow_dispatch` with `package_windows=true`) receives an isolated run-specific concurrency group and `cancel-in-progress=false`. Routine CI continues to cancel superseded same-ref runs. The previous Shipping run #42765030903 was cancelled while waiting for a matching runner; **do not classify it as a build failure or success**.
2. `Build-TSMNativeWindows.ps1` now requires a certificate thumbprint and HTTPS timestamp server, signs the **cooked `TSMNative.exe` before invoking Inno Setup**, then verifies Authenticode and prints a SHA-256 digest. The existing workflow separately signs the finished installer. Both must pass; a signed wrapper is not proof of a signed executable.

## Required private runner setup

- A Windows 11 x64 GitHub Actions runner labeled `self-hosted`, `windows`, `x64`, `ue5` with authorized UE 5.8, MSVC, Cesium for Unreal 2.29.1, CMake/Ninja, Inno Setup, SignTool and SpatiaLite.
- `UE_ROOT`, `TSM_NATIVE_DATA_ROOT`, `TSM_LOCAL_TILESET`, `TSM_SPATIALITE_DLL`, and `TSM_WINDOWS_TIMESTAMP_URL` configured for the job. Use `TSM_WINDOWS_SIGNING_CERT_SHA1` as a protected secret, **never paste certificate private keys, account tokens, or passwords into chat or Git**.
- The signing identity must be installed and accessible to the actual runner account, with proper private-key permission and a valid code-signing certificate. This patch does not provision, purchase, or impersonate such a certificate.

## Storage separation

Existing private Google Drive destinations:

- Source TSMData input snapshots: https://drive.google.com/drive/folders/1efwQlV1D3Aat4rhcmYPoo_kNtCRMNUt3
- Signed executable installer and evidence outputs: https://drive.google.com/drive/folders/1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF

Do not claim the user's screenshot of a **20 GB storage quota** is proof of Windows local disk space, Drive quota, or enough scratch space to install/build UE. The actual machine may need substantially more free space for engine build/cook/intermediate files. Keep large binaries outside Git and upload them to Drive only after their hashes, signatures and source provenance have been verified. The archive should include the separately signed cooked executable and its hash manifest, in addition to the signed installer and build transcript. The release archive/publisher must be reviewed for this wider packaging before claims about a Drive copy of the signed executable.

## Acceptance

- **UE Shipping static:** real BuildCookRun success at immutable checkout SHA, `.umap` in cooked content, source-pinned TSMData, genuine AMD64 executable, local 3D Tiles, signed cooked `TSMNative.exe` and signed setup, SHA-256 evidence, SBOM.
- **Independent runtime:** install on clean Windows 11 with network disconnected; capture native HUD/menu clicks, first launch and exit, terrain and 3D Tiles streaming, FPS/VRAM and screenshots. A firewall smoke probe alone does not pass this gate.
- **Engineering provenance:** source CRS, vertical units, datum and authority per layer must be documented. Existing Posey DEM source EPSG:2968 and unverified vertical datum are not automatically EPSG:2966/NAVD88.

This is a workflow and source-code repair only. **No successful packaged UE5.8 executable or clean-host runtime has been produced by this PR.**
