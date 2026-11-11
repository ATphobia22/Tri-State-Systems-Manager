# Mount Vernon UE5.8 headed integration

TSM uses **TSMNative** as its sole native Unreal module; avoid adding a second PointTownship module or editor build target.

## Headed build
```powershell
.\scripts\native\Invoke-MountVernonHeadedBuild.ps1 -UnrealRoot 'C:\Program Files\Epic Games\UE_5.8' -Target Editor
```

Open the canonical `tsm-native/TSMNative.uproject`; run the verified regional .umap in PIE. A successful build only establishes compilation, **not** working actors, source geometry, visual quality or packaging.

## Scene controls
The existing native Slate HUD now exposes BUILDINGS, FLOODPLAIN and a grouped UTILITIES visibility toggle, plus SAVE LAYERS and LOAD LAYERS. The subsystem registers only actual actors supplied with source identifiers and SHA256-format hashes. These buttons do not import GIS files or generate data; the status explicitly distinguishes missing sources. The saved profile is local to `Saved/TSM/SceneProfiles/operator-default.json`.

Verify in headed PIE: register real actors, click each toggle, confirm visibility changes, save and restore visibility, test an absent-source category, verify no fictional 'compliance' tint.

## Shipping path
```powershell
.\scripts\native\Invoke-MountVernonHeadedBuild.ps1 -UnrealRoot 'C:\Program Files\Epic Games\UE_5.8' -Target Shipping
```

The Shipping wrapper delegates to existing `Build-TSMNativeWindows.ps1`, preserving generation, ArchimedesCore and SpatiaLite dependencies, signing, and Inno Setup gates. It does not substitute a new generic BuildCookRun batch file for the validated pipeline. Keep raw GeoPackages and manifests in an explicitly staged offline data root; raw .gpkg is **not** a cooked Unreal uasset.

### Evidence still required
- Real local native .umap and source-provenanced Mount Vernon GIS assets
- H3 C library linkage and streaming controls, GeoPackage parsing with valid geometry envelopes
- Native building raycast and inspection UI with validated elevation and survey metadata
- A completed Windows UE5.8 Shipping build log and executable
- Windows 11 clean-machine, network-disabled startup and rendered screenshot/FPS/VRAM capture
- Verified local TSMData manifest/checksums; no external services
