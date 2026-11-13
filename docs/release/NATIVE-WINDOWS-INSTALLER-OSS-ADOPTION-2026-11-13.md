# TSM Native Windows 11 distribution / OSS adoption audit — 2026-11-13

## Release decision

**Primary:** complete **offline Inno Setup 7.1.1 x64** signed installer for UE5.8 Shipping, with ArchimedesCore, SQLite/SpatiaLite, Cesium local assets and independently staged TSMData. The setup and application require **no sign-in and no network to install/run**. The release *build* is online for RFC3161 timestamping. The installer must include **actual cooked content and its SHA-256/source/datum evidence**, not placeholder terrain or fake buildings. Never mark the UE release verified from a Tauri workflow.

**Optional online:** publish the **same signed offline installer** as a versioned GitHub Release asset, and only then generate a WinGet `inno` manifest from the independently verified Authenticode release receipt and exact local SHA-256. WinGet can *download and install* the native EXE; the app remains offline after installation. Publishing a WinGet manifest is separate from building the application. The generator does not upload a release, talk to GitHub, or attest that a remote URL exists.

**Alternative managed deployment, not in current build:** Microsoft MSIX / Windows App SDK (requires framework packages, certificate/package identity management), WiX Toolset/MSI or Burn bootstrapper (extra installer platform and QA). No reason to add an external UI/runtime or a Windows service merely to ship TSM.

### Critical Inno signing fix

The previous `Build-TSMNativeWindows.ps1` signed the cooked `TSMNative.exe`, ran `ISCC.exe`, and left setup signing to a separate GitHub Actions step. According to [Inno Setup SignTool](https://jrsoftware.org/ishelp/topic_setup_signtool.htm), signing *after* compilation does **not** automatically sign uninstaller or temporary self-copies. This can trigger Windows ASR and cause install/updates to fail. The new `SignTool=tsmrelease` and `SignedUninstaller=yes` are compiled with the exact release certificate; the Windows Actions stage independently **verifies** setup instead of re-signing it. The signing key remains in the runner's certificate store, never repository data.

Authoritative docs: [Inno Setup 7.1.1 downloads](https://jrsoftware.org/isdl.php) (2026-10-28), [compiler `--signtool` option](https://jrsoftware.org/ishelp/topic_compilercmdline.htm), [SignedUninstaller](https://jrsoftware.org/ishelp/topic_setup_signeduninstaller.htm), [WinGet manifest](https://learn.microsoft.com/windows/package-manager/package/manifest).

Inno Setup 7.1.1 commercial licensing must be checked for the distributing entity. TSM repo is Apache-2.0; third-party Unreal/Cesium/SpatiaLite and data have **independent redistribution requirements**; do not infer all bundled binaries are Apache-2.0.

### Single-executable size boundary

Inno Setup 7's **single signed EXE has a near-4 GB Windows size limit**. The official [DiskSpanning documentation](https://jrsoftware.org/ishelp/topic_setup_diskspanning.htm) requires it for compressed content exceeding **4,200,000,000 bytes**, and signed large single EXEs can incur slow Windows signature verification. This current release script explicitly uses `DiskSpanning=no`: if the true Shipping payload exceeds this limit, **the single-EXE installer gate must fail**, not drop data. A separate split offline kit (`Setup.exe` plus required hash-verified `.bin` slices kept together, or a signed/hashed archive containing the complete kit) requires a distinct packaging and integrity gate, not an incorrectly labeled single executable. WinGet support for a multi-part kit is not asserted. No evidence here demonstrates the actual package size.

### Online manifest after real signed shipping output

```powershell
python scripts/release/create_native_winget_manifest.py `
  --installer dist/installer/TSM-Native-Setup-1.0.0-windows-x64.exe `
  --signed-receipt dist/provenance/native-signed-artifact-evidence.json `
  --version 1.0.0 `
  --release-url https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/v1.0.0/TSM-Native-Setup-1.0.0-windows-x64.exe `
  --output dist/winget/TriStateSystemsManager.TSMNative.yaml
```

This is an **illustrative command only**. It must fail until the real signed file and matching source SHA-256 evidence exist. It does not verify that the release asset is publicly accessible. After uploading the approved signed artifact, independently check its HTTPS download, length, hash and GitHub release provenance, then submit the WinGet candidate for review; install on a separate clean Windows 11 x64 VM, disconnect network, and validate UE5.8 Shipping startup and GPU/terrain/tiles.

## Repository applicability review

A review of the supplied GitHub repositories (current repository metadata retrieved on 2026-11-13) identifies **reference patterns**, not permission to distribute another project's executable or modify users' Windows systems.

| Repository | License listed on GitHub | Use in TSM |
| --- | --- | --- |
| [Raphire/Win11Debloat](https://github.com/Raphire/Win11Debloat) | MIT | **Do not bundle/run** debloating or disable OS telemetry, Store, services, security or updates. User-controlled workstation utilities are outside TSM install scope |
| [Dujltqzv/Some-Many-Books](https://github.com/Dujltqzv/Some-Many-Books) | Not declared | **Do not ingest/distribute** third-party book downloads or links without content rights and primary-source verification |
| [ntdevlabs/tiny11builder](https://github.com/ntdevlabs/tiny11builder) | Not declared | **Do not replace/mod Windows images**. The clean-room release must run on supported stock Windows 11 |
| [TGSAN/CMWTAT_Digital_Edition](https://github.com/TGSAN/CMWTAT_Digital_Edition) | NOASSERTION | **Never integrate activation/licensing bypass tooling**. Valid Windows licensing remains user's responsibility |
| [MustardChef/WSABuilds](https://github.com/MustardChef/WSABuilds) | AGPL-3.0 | No Android subsystem or root/GApps needed for native UE Win64 |
| [eythaann/Seelen-UI](https://github.com/eythaann/Seelen-UI) | AGPL-3.0 | Full Windows desktop shell replacement conflicts with an unobtrusive native installer; do not ship |
| [Blinue/Magpie](https://github.com/Blinue/Magpie) | GPL-3.0 | Upscaling/performance **research only**; prefer Unreal's own TSR/DLSS path and headed benchmarks, no third-party copy |
| [AveYo/MediaCreationTool.bat](https://github.com/AveYo/MediaCreationTool.bat) | MIT | Do not bypass Windows 11 hardware/TPM requirements or alter OS setup |
| [farag2/Sophia-Script-for-Windows](https://github.com/farag2/Sophia-Script-for-Windows) | MIT | Never make global OS tuning or privacy changes during app installation |
| [AutoDarkMode/Windows-Auto-Night-Mode](https://github.com/AutoDarkMode/Windows-Auto-Night-Mode) | GPL-3.0 | Reference for honoring Windows dark/light theme; do not bundle a theme daemon |
| [microsoft/microsoft-ui-xaml](https://github.com/microsoft/microsoft-ui-xaml) | MIT | WinUI 3 Fluent/native controls **candidate for a future separate launcher**; do not replace existing UE HUD or add WinAppSDK dependency without proof |
| [microsoft/WinUI-Gallery](https://github.com/microsoft/WinUI-Gallery) | MIT | Native accessibility, high-DPI, navigation, InfoBar design references; not a production shell dependency |
| [microsoft/PowerToys](https://github.com/microsoft/PowerToys) | MIT | Design/testing examples for Windows shortcut handling, logging, settings and multi-process lifetime; do not vendor application |
| [microsoft/msix-packaging](https://github.com/microsoft/msix-packaging) | MIT | Optional future MSIX for enterprise-managed deployment; package graph/framework requirements must work offline |
| [microsoft/winget-cli](https://github.com/microsoft/winget-cli) | MIT | **Adopt manifest-driven online distribution**; no WinGet process in offline runtime |
| [microsoft/DirectX-Graphics-Samples](https://github.com/microsoft/DirectX-Graphics-Samples) | MIT | Reference D3D12 GPU profiling, DRED/device loss and reversed-Z; use Unreal RHI/RenderDoc/PIX APIs to test actual native scene, not a parallel renderer |
| [microsoft/DirectX-Headers](https://github.com/microsoft/DirectX-Headers) | MIT | Consider only for standalone C++ tooling needing newer D3D12 interfaces; Unreal/Windows SDK already provides required engine interop |
| [microsoft/CsWinRT](https://github.com/microsoft/CsWinRT) | MIT | Not applicable to core UE C++ today; only for an independently justified C# companion |

## Required installer release gates (not yet certified)

1. An actual UE5.8 Shipping `BuildCookRun` with **local staged data** and a real cooked `.umap`/content, signed `TSMNative.exe`, signed companion, compiled Inno 7.1.1 setup, verified uninstaller signature and no unstaged source data.
2. Full binary and raster/polygon source inventory and exact license/redistribution evidence, with source SHA256, NAVD88 geoid and EPSG provenance. A binary format or reference count does not certify engineering accuracy.
3. SignTool `verify /pa /all`, receipt with actual signing certificate/timestamp, SHA256SUMS and immutable commit. Verify downloaded release bytes against the receipt *after publication*.
4. Install/uninstall/reinstall on stock clean Windows 11 x64, network disabled, no localhost/WebView/Node dependency and no data deletion; capture headed screenshots, FPS, GPU and GPU resource use.
5. Release labels: **verified**, **pending**, **blocked**, **not evidenced**. No automatic "green main" or "shipping verified" based on static tests.

**Implementation boundary:** This PR includes compiler-signing integration, an offline installer policy and a receipt-gated optional WinGet manifest. It does not build an MSI/MSIX, enable a separate app launcher, install OS debloat tools, produce an actual installer without authorized UE runner, or upload a WinGet package.
