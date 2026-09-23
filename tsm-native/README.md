# TSM Native Simulation Package

This is the native Unreal Engine 5 runtime target for Tri-State Systems Manager.

The packaged TSM runtime is not a web application. It does not start Node.js, Vite, a browser, localhost services, or a REST server. Engineering computation is performed in-process through the ArchimedesCore C ABI, and persistent state is stored in an embedded SQLite database.

The native target is deliberately separate from the existing web/console implementation so the transition can be validated without deleting the current evidence, ingestion, or data-fabric code prematurely.

## Rendering

- Unreal Engine 5 C++ application
- DirectX 12 on Windows
- Vulkan on supported Linux targets
- Nanite/Lumen for desktop visualization
- OpenXR for head-mounted XR
- Cesium for Unreal is an optional geospatial renderer for local 3D Tiles/terrain assets

## Geospatial

Local datasets are loaded from packaged or user-selected files. Cesium for Unreal supports local 3D Tiles datasets from disk without an internet connection.

## Data

UE 5.8 provides SQLiteCore as a native SQLite wrapper. TSM uses SQLite for the embedded store. SpatiaLite remains an optional, explicitly packaged extension because it is a separate spatial extension to SQLite.

## XR

OpenXR is enabled for head-mounted AR/VR. Unreal's OpenXR implementation supports Windows and Android head-mounted devices; handheld AR is a separate platform path.

## Build prerequisites

1. Unreal Engine 5.8.
2. Visual Studio 2022 with C++ desktop/game development components for Windows.
3. Xcode and Unreal prerequisites for macOS.
4. Cesium for Unreal only when geospatial 3D Tiles rendering is enabled.
5. A separately built ArchimedesCore shared library.

The repository does not commit Unreal Engine, proprietary SDKs, signing certificates, or third-party binary plugins.

## Security boundary

The native runtime has no application-level network client. No HTTP/WebSocket/REST service is required to render or run the local simulation. Data ingestion remains a separate, signed/offline preparation pipeline.

This is intentionally stronger than simply replacing localhost with another local server: there is no local server in the runtime architecture.
