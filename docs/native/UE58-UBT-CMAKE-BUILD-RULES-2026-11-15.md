# UE 5.8 UnrealBuildTool + CMake rules (TSMNative)

**Dated:** 2026-11-15  
**Engine:** Unreal Engine 5.8 (`EngineAssociation` in `TSMNative.uproject`)

## Files

| Path | Role |
|------|------|
| `Source/TSMNative/TSMNative.Build.cs` | Module rules: Core/Engine, **Slate/SlateCore**, UMG, CesiumRuntime, SQLite, TSMCrypto, OpenXR |
| `Source/TSMNative.Target.cs` | Game / Shipping target (`TargetType.Game`, `Unreal5_8`) |
| `Source/TSMNativeEditor.Target.cs` | Editor target |
| `CMakeLists.txt` | **IDE indexing only** — does not replace UBT |

Legacy copies under `Source/TSMNative/*Target.cs` may remain; UBT prefers targets adjacent to the `Source/` module folder as `ModuleName.Target.cs`.

## Dependency intent

- **Slate / SlateCore / UMG** — engineering HUD and runtime UI.
- **Engine** — World Partition, data layers, subsystems (`TSMEngineeringRuntimeSubsystem`, scene-layer manager).
- **CesiumRuntime** — 3D Tiles / terrain when Cesium for Unreal is enabled in the `.uproject`.
- **SQLite* + TSMCrypto** — offline evidence paths; not a substitute for the web Merkle ledger authority model.

## Build commands (host with UE 5.8 installed)

```text
# Editor
RunUAT.bat BuildCookRun -project=TSMNative.uproject -platform=Win64 -clientconfig=Development -build

# Shipping (example)
RunUAT.bat BuildCookRun -project=TSMNative.uproject -platform=Win64 -clientconfig=Shipping -build -cook -stage -pak
```

Windows helper scripts under `scripts/native/` remain the project entry points when present.

## Automation tests (next)

Unreal Automation Framework can exercise `ATSMSceneLayerManager` lens transitions and layer visibility (BUILDINGS / FLOODPLAIN / UTILITIES) without claiming geospatial regulatory truth. Implement under `Source/TSMNative/Private/Tests/` when the manager class is stable.

## Non-claims

Successful UBT configuration is **compile wiring**, not proof of a signed Shipping package, air-gapped runtime, or FEMA/survey authority.
