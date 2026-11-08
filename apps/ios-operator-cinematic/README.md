# TSM Operator Cinematic — iOS

A standalone, native **SwiftUI + SceneKit** iOS app for the Tri-State River Valley. It is intentionally separate from the existing `tsm-console/ios` Capacitor/Xcode target, so it cannot break that shipping target's source or configuration.

## What works in the source project

- Interactive miniature city and river: generated terrain mesh, deterministic buildings, road network, berm, stylized water, survey grid.
- Orbit, top-down drone and animated cinematic camera; pinch/drag orbit in scene, tap-to-inspect conceptual structures.
- Animated water surface, physical-style materials, cinematic lights, night/day change.
- Switchable scene overlays and adjustable concept berm height, access road lift and water offset.
- Source-honest gauge panel for USGS `03378500` (Wabash at New Harmony, IN) and `03322000` (Wabash at Mount Carmel, IL). **No readings are invented or labeled live.**
- Offline-by-default; all primary visuals native and generated on device. **No CDN, localhost server, WebView, API key or login.**
- Independent Foundation-based core with unit tests for missing-data, vertical-datum gating, bounding and serialization.

**Important:** Scene geometry is an illustrative miniature, *not* the certified Posey County terrain, FEMA regulatory map, engineering simulation, surveyed parcel boundaries or complete 23,082 building models. The sliders change visual geometry only, and the shield overlay is review-only; neither asserts an emergency. Do not use visual water offsets for flood elevations, hazard forecasts or construction designs.

## Build and run (macOS with Xcode)

1. Install a recent Xcode version supporting iOS 17+, command-line tools and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
2. From this directory, run `xcodegen generate --spec project.yml`.
3. `xcodebuild -project TSMOperatorCinematic.xcodeproj -scheme TSMOperatorCinematic -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`.
4. Open the generated Xcode project and run on an iPhone simulator or provisioned device.
5. For physical device / TestFlight / App Store distribution, set your own `PRODUCT_BUNDLE_IDENTIFIER`, Apple Developer Team, code signing and App Store Connect records. Archive the scheme using Xcode. No `.ipa` is supplied without an actual signed Apple build.

The existing repository's `tsm-console/ios` remains intact. For regression testing of the portable core from macOS or Linux:

```bash
swift test --package-path apps/ios-operator-cinematic
swiftc -frontend -parse apps/ios-operator-cinematic/Sources/{Core,Scene,App}/*.swift
```

## Data integration sequence

1. Export a **verified, hash-pinned, locally packaged** TSM evidence manifest, tiled terrain/building meshes and layer inventory. The original CRS, NAVD88/vertical-grid model, units, acquisition dates, authority, tile checksum and coverage must travel with every asset.
2. Resolve all geodetic transforms in the preprocessing/evidence plane. On-device local rendering uses metre-based origins; never interpret raw EPSG:2966 US survey feet as metres or mix NAVD88 with ellipsoidal heights.
3. Replace the conceptual city nodes only after source-identity reconciliation (Posey 23,082 target is not assumed complete).
4. Load independently validated FEMA effective NFHL, keeping preliminary/pending/DNR nonregulatory layers separate. Only after checks, expose geometry to the user with its evidence state.
5. Wire a source-validated **optional live** USGS Water Data OGC API adapter; observe timestamp, stage datum and station metadata. Offline absence stays `SOURCE_UNAVAILABLE`.
6. Acquire separate headful iOS render, FPS, memory, energy and accessibility evidence on a real device. An Xcode simulator build is not a device performance or native Windows UE5.8 gate.

## Scope of automated tests

`swift test`: pure core validation. `xcodebuild ... build`: native iOS compilation, run in macOS GitHub Actions. Passing either is not an App Store deployment or geospatial / survey certification. The scene uses Apple's SceneKit API, which Apple currently labels deprecated; its rendering backend can later be migrated to RealityKit/Metal after performance profiling.

## Implemented next milestone (2026-11-08)

- `Sources/Core/OfflineScene.swift`: renderer-independent preprojected scene format with strict ID, extent and provenance validations (a byte SHA is **not** source certification).
- `Sources/App/OfflineSceneImporter.swift`: Files picker security-scoped import plus CryptoKit SHA-256 verification before rendering; 12 MiB input cap.
- `Sources/Scene/CitySceneController.swift`: load local real-source bounding-box previews without displaying the concept terrain or concept water as authoritative. The view rescales imported geometry for visualization only; the UI explicitly labels the display scaling and unreviewed source.
- `scripts/export_offline_scene.py`: bounded conversion from **operator-declared EPSG:2966 (US survey foot)** GeoJSON source footprints into checksum-bound iOS tiles. Up to 6,000 buildings per tile. Never substitutes missing heights. Preserves the raw input file SHA, transform recipe, original origin coordinates, and an inclusion/exclusion inventory. Tiles are simple rectangles and are **not** LoD2/LoD3 or surveyed geometry.
- `Sources/Core/USGSObservations.swift` + `Sources/App/USGSObservationService.swift`: optional user-initiated HTTPS lookup from USGS OGC `latest-continuous`, only parameter 00065 (gage height in feet), with station/time/unit filters and separate STALE/OBSERVED/UNAVAILABLE states. The iOS app does **not** invent a station NAVD88 gauge zero.
- Concept scenario presets save locally and are not advertised as actual engineering simulations.

### Prepare an offline GIS tile

Input must be separately documented as **EPSG:2966 with US survey feet**; the script does not inspect/reproject unknown CRS. Verify that the height field has source-specific vertical semantics and is measured in US survey feet. Required origin is an independently documented EPSG:2966 site anchor.

```bash
python3 apps/ios-operator-cinematic/scripts/export_offline_scene.py \
  /path/to/verified-posey-footprints.geojson \
  /path/to/staged-ios-tiles \
  --height-field height_usft \
  --origin-easting-usft 0 --origin-northing-usft 0 \
  --authority 'Operator-reviewed source description'
```

**Replace the two example zero-origin values with the actual source-data origin.** They are command placeholders, not surveyed coordinates. Review `scene-inventory.json`, all skipped geometries, feature IDs, source checksum, and alignment before import. Use the iOS **IMPORT CHECKED TILE** control to import one `.tsm-scene.json` tile. This subset preview is local and remains `UNREVIEWED`. SceneKit drawing is not evidence of county coverage or LiDAR validation.

For device diagnostics, capture Xcode Organizer energy/memory performance and headed screenshots. The first macOS simulator build on GitHub Actions remains independently required; local Linux validation cannot compile SwiftUI/SceneKit.


## Extended local-metric terrain package (additional format)

The optional `TSMWorldPacker` command creates a checksum-verified `.tsmworld` package from **already prepared** `LOCAL_ENU_METERS` terrain grids, building footprints and river centerlines. Source CRS/vertical datum/units are explicit; no datum conversion is inferred. The deterministic synthetic example at `Resources/demo-world.tsmworld` is **not** Posey County terrain. Run:

```bash
swift test --package-path apps/ios-operator-cinematic
swift run --package-path apps/ios-operator-cinematic TSMWorldPacker --verify apps/ios-operator-cinematic/Resources/demo-world.tsmworld
```

The existing app's `OfflineScene` import path remains unchanged. The additional terrain package is an independently tested **preparation contract**; full native renderer/UI integration and authoritative countywide assets remain separate gates. The CI workflow uses immutable GitHub Action SHAs.
