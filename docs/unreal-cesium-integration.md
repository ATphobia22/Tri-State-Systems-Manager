# TSM Unreal Engine Integration — Cesium for Unreal

## Overview

Load the TSM HLOD 3D Tiles building dataset in Unreal Engine 5 using the
**Cesium for Unreal** plugin (open source, MIT). No Cesium ion token required
for self-hosted tilesets.

**Existing setup:** The repository already contains `tsm-native/TSMNative.uproject`
with `CesiumForUnreal` enabled. This document covers tileset configuration,
not plugin installation.

### 2. Add Cesium3DTileset Actor

In your Level (using the existing `tsm-native/TSMNative.uproject`):
1. Place a **Cesium3DTileset** actor
2. In Details panel, set **Source** to "From Url"
3. Set **Url** to your tileset.json:
   ```
   https://your-host/3d-tiles/buildings/tileset.json
   ```

### 3. Configure for TSM HLOD Tileset

The TSM tileset uses:
- 3D Tiles 1.1 with `ADD` refinement
- Draco-compressed GLBs (`KHR_draco_mesh_compression`)
- Local ENU coordinates (not ECEF)

**Important:** The TSM building tiles use a local coordinate frame, not
WGS84 ECEF. For correct georeferencing in Unreal:

Option A — Use CesiumGeoreference:
1. Add **CesiumGeoreference** actor to level
2. Set Origin to the TSM anchor:
   - Latitude: 37.845887
   - Longitude: -88.005075
   - Height: 0 (tiles use local Z in feet; convert as needed)
3. The tileset will be positioned relative to this origin

Option B — Manual transform:
1. Select the Cesium3DTileset actor
2. Set Location to convert from local ENU (feet) to Unreal units (cm):
   - 1 foot = 30.48 cm
   - Apply scale and offset to match your level's coordinate system

### 4. Draco Support

Cesium for Unreal includes Draco decoding natively. No additional setup needed.
The `KHR_draco_mesh_compression` extension in the TSM GLBs is handled automatically.

### 5. Performance Tuning

For the 86-tile HLOD dataset:
- **Maximum Screen Space Error:** 16 (default) — lower for more detail
- **Preload Ancestors:** true (smoother LOD transitions)
- **Preload Siblings:** false (saves memory)
- **Forbid Holes:** false (allows faster loading)

## Project Configuration File

A sample `DefaultEngine.ini` addition for Cesium:

```ini
[/Script/CesiumRuntime.CesiumRuntimeSettings]
; Self-hosted — no ion token
DefaultIonAccessToken=
```

## Level Blueprint Example

To load the tileset at runtime via Blueprint:
1. Get reference to Cesium3DTileset actor
2. Call `Set Url` with your tileset URL
3. Call `Refresh Tileset`

## Limitations

- TSM building tiles are LOD1 (extruded prisms), not photogrammetry
- Colors indicate flood screening status (blue=touched, gray=dry)
- Not survey-grade geometry — visualization only
- Local coordinate frame requires manual georeferencing (see above)
