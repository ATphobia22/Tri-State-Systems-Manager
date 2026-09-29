# TSM Native World Interaction & Engineering Masterclass Specification

## Runtime boundary
- Unreal Engine 5.8 native runtime is canonical.
- Browser, WebView, localhost, Node, and network-required simulation are prohibited.
- Web/console surfaces remain ingestion/administration/development compatibility only.

## World interaction
The native experience shall support selection and interrogation of terrain, parcels, buildings, roads, bridges, culverts, levees, channels, utilities, flood zones, water, and engineering design objects.

Every meaningful measurement/result shall preserve value, unit, geographic coordinate, CRS, vertical datum, source identity/version/hash, acquisition or scenario timestamp, method, resolution, and uncertainty where applicable.

## Terrain and measurements
Support elevation, slope, aspect, contour/profile, coordinate inspection, distance, 3D distance, elevation difference, grade, bearing, area, volume, cut/fill, freeboard, flood depth, and source inspection.

## Flood fabric
Separate:
1. authoritative/evidence surfaces;
2. modeled scenario surfaces;
3. cinematic presentation water.

Historical, regulatory, observed, design, current, and future scenarios must remain distinguishable. Scenario snapshots must be reproducible and immutable.

No synthetic 100-year/500-year/historical multipliers may be introduced. Scenario hydraulic/hydrologic inputs must be source-bound or explicitly classified assumptions.

## Engineering design
Native interactive berm and road placement shall support alignment, stationing, profile, grade, dimensions, cut/fill, quantities, flood intersection, parcel/ROW intersection, freeboard, drainage screening, and material assignment.

Conceptual designs shall be clearly distinguished from survey-controlled or stamped engineering designs.

## Materials
Material records shall support density, roughness, permeability, porosity, strength, erosion, cost, standards/source references, and uncertainty when data are actually available.

## Evidence and provenance
The provenance chain shall be traceable:
Source → Dataset → Version → Acquisition → Transformation → Model → Calculation → Result → Visualization → Artifact.

Missing evidence must fail closed.

## Design IR and artifacts
TSM Design IR is the canonical conceptual-design exchange format for Unreal, USD, BIM, CAD, and documentation adapters.

Generated documentation may be blueprint-ready. Actual Unreal Blueprint .uasset generation must not be claimed until the asset is generated and validated by Unreal.

Artifacts shall carry scenario, source, model, calculation, version, and provenance references.

## Cinematic fabric
Support engineering and cinematic camera presets, lighting/weather presets, Sequencer integration, and Movie Render Queue/Graph-compatible rendering.

Cinematic rendering is presentation only and must not mutate engineering state.

## Performance and security
Interaction, rendering, simulation, streaming, provenance, and artifact generation shall remain bounded and separated. External Python/Houdini/MCP/DCC capabilities require explicit adapters and cannot grant arbitrary runtime filesystem/process/network access.

## Verification
Each subsystem requires contract tests before implementation. Full verification includes repository contract checks, native static validation, mathematical tests, data/provenance checks, and UE5.8 compilation/package tests when the required self-hosted UE runner is available.

A skipped UE packaging job is never reported as successful packaging.
