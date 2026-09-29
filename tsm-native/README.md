# TSM Native Engineering Masterclass

The canonical operator product is a **native Unreal Engine 5.8 application**.

It contains no browser runtime, Electron shell, WebView, Node.js service, localhost API, or REST dependency for simulation.

## Experience

TSM is a cinematic engineering digital twin rather than a conventional dashboard:

- open-world geospatial terrain and infrastructure;
- Nanite/Lumen desktop rendering;
- native Slate/UMG engineering HUD;
- collapsible in-world controls;
- terrain/elevation inspection;
- hydrology and hydraulics;
- current, 100-year, 500-year, historic 1937, and custom scenario modes;
- flood-depth and freeboard analysis;
- berm and road screening;
- earthwork quantities;
- evidence and provenance inspection;
- local engineering report generation;
- blueprint-ready design notes;
- grant evidence narrative generation;
- simulation snapshots and reproducible scenario packages.

The native HUD is an overlay on the Unreal game viewport, which is the supported mechanism for in-game Slate UI.

## Engineering boundary

The first native calculation layer includes:

- Rational-method peak-flow screening;
- Manning velocity;
- Manning discharge capacity;
- terrain-to-water-surface flood depth;
- freeboard/design elevation;
- trapezoidal berm cross-section;
- berm fill volume.

The system deliberately does **not** manufacture flood-frequency multipliers. A 100-year/500-year/historical scenario must receive its flow or stage parameters from a source-bound scenario record.

USGS documentation emphasizes that Rational Method inputs such as runoff coefficient and time of concentration require engineering judgment and that validation is difficult without observed data. Historical flood discharge estimation can also carry substantial uncertainty.

For hydraulic design, calibrated model evidence remains separate from screening calculations. USGS HEC-RAS guidance describes validation/calibration against observed stage/flow information and terrain/hydraulic structure behavior.

## Offline data fabric

Native builds package a manifest-backed TSMData directory.

The package boundary is:

1. immutable source snapshot;
2. SHA-256 manifest;
3. verification before packaging;
4. native UE staging;
5. packaged local data;
6. no silent network fallback.

The authoritative source catalog is:

tsm-native/config/authoritative-source-catalog.json

The product contract is:

tsm-native/config/native-product-contract.json

The staging pipeline is:

scripts/native/stage-native-data-root.mjs

Unreal packaging is configured to stage TSMData as packaged non-asset data. Epic's Unreal Engine documentation identifies DirectoriesToAlwaysStageAsUFS as the mechanism for including additional non-asset directories in packaged output.

## Platform targets

- Windows x64/ARM64
- macOS arm64/x86_64
- Linux x86_64/arm64
- iOS/iPadOS arm64
- Android arm64-v8a/x86_64
- OpenXR where supported

Windows is the primary desktop engineering deployment target. The same platform-neutral numerical core is used wherever the target platform supports the required native runtime.

## Build prerequisites

1. Unreal Engine 5.8.
2. Visual Studio 2022 with C++ desktop/game development components for Windows.
3. Xcode and Unreal prerequisites for Apple targets.
4. Cesium for Unreal 2.29.1 when local 3D Tiles/terrain rendering is enabled.
5. A separately built ArchimedesCore native library.
6. An immutable TSM native data snapshot with data-manifest.json.

The repository does not commit Unreal Engine, proprietary SDKs, signing certificates, or third-party binary plugins.

## Human engineering authority

TSM is decision-support software.

It produces traceable modeled scenarios, calculations, documentation, and evidence packages. It does not independently issue regulatory determinations, certify designs, or replace professional engineering judgment.

## Web migration

tsm-console is retained as a legacy compatibility, ingestion, and development surface during migration.

New operator features must be implemented in the native runtime first.

The native Unreal application is the final product boundary.
