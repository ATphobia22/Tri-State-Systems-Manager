# TSM Native-First Engineering Architecture

## Product boundary

The production operator application is a native Unreal Engine 5.8 application.

It is not a browser application, Electron application, localhost web server, or WebView shell.

The existing tsm-console/ web application remains in the repository as a development, ingestion, CI, and migration surface. It is not the canonical operator runtime.

## Experience

TSM is designed as a cinematic engineering digital twin:

- open-world terrain and infrastructure visualization;
- native interactive HUD overlays that can collapse without leaving the world;
- terrain/elevation inspection;
- parcel and infrastructure evidence;
- hydrology and hydraulics controls;
- current, design, and historical flood scenarios;
- berm and road placement screening;
- earthwork quantity calculations;
- engineering measurement tools;
- evidence/provenance inspection;
- simulation snapshots;
- native report and documentation generation.

The presentation target is a high-fidelity engineering simulation experience rather than a conventional enterprise dashboard.

## Native data fabric

Runtime data is local and manifest-backed.

The packaged data boundary is:

1. authoritative acquisition occurs outside the runtime;
2. every runtime file is listed in data-manifest.json;
3. every listed file has SHA-256 and byte-size integrity metadata;
4. the runtime refuses an incomplete or altered data snapshot;
5. effective regulatory mapping, modeled engineering outputs, historical reconstruction, and screening calculations remain distinct evidence classes.

The runtime does not silently substitute an internet source when a local authoritative asset is missing.

## Engineering calculation boundary

The native engineering subsystem exposes deterministic, unit-explicit calculations through Unreal reflection so they can be called by C++ and Blueprint tooling.

Implemented baseline methods include:

- Rational-method peak runoff screening;
- Manning velocity;
- Manning conveyance capacity;
- flood depth from terrain/water-surface elevation;
- required design elevation from freeboard;
- trapezoidal berm cross-sectional area;
- berm fill volume.

These methods are screening calculations. They do not replace calibrated HEC-RAS or other validated hydraulic models, survey control, engineering judgment, or regulatory determinations.

Every exported result carries the methodology version and uncertainty boundary.

## Future scenario discipline

Scenario multipliers and synthetic assumptions are explicitly labeled as modeled assumptions. They must never be presented as measured or regulatory values.

Future scenario outputs should display:

- source observations;
- model assumptions;
- calculation method;
- units;
- uncertainty;
- evidence class;
- timestamp;
- source/hash identifiers;
- model/version identifier.

## Artifact generation

The native runtime is intended to generate:

- engineering scenario reports;
- calculation datasets;
- blueprint-ready design packages;
- grant-support evidence packages;
- source/provenance manifests;
- simulation snapshots.

Human engineers and agencies remain the decision authority.

## Platform targets

The same engineering core is designed for:

- Windows x64/ARM64;
- macOS Apple Silicon/Intel;
- Linux x64/ARM64;
- iOS/iPadOS arm64;
- Android arm64-v8a/x86_64;
- OpenXR-capable devices where supported.

Rendering and packaging are platform-specific. Engineering contracts and data provenance remain platform-neutral.

## Security model

The native runtime has no application-level HTTP/WebSocket/REST dependency.

Network access is not required to:

- load the world;
- inspect packaged data;
- run local calculations;
- execute local scenario simulations;
- produce local reports.

External acquisition and synchronization remain separate controlled workflows.

## Web migration status

tsm-console/ is a legacy compatibility and engineering-support surface.

New operator features must be implemented in the native runtime first. New production capabilities must not require a browser or WebView.

The native runtime is the target for the final Windows and multi-platform product.
