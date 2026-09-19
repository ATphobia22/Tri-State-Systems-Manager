# TSM Open-World Digital Twin Architecture

## Source hierarchy

### Tier A — authoritative evidence
Government, survey, engineering, and instrumented datasets with explicit provenance and applicable accuracy metadata.

### Tier B — TSM-derived engineering products
Terrain meshes, 3D building products, vector tiles, hydraulic surfaces, and analytical products derived from permitted Tier A data. Each product carries source lineage and processing metadata.

### Tier C — observational/reference presentation
Mapillary, Apple Look Around, photogrammetry, Gaussian splats, synthetic renders, and similar visual sources. These are never promoted to authoritative geometry automatically.

### Tier D — cinematic presentation
Ray-traced/WebGPU effects, atmospheric rendering, water shaders, procedural scenery, and other visual effects. These never become evidence.

## Building footprints

The TSM building hierarchy is:
1. survey/engineering geometry where available;
2. authoritative government geometry;
3. Indiana LiDAR-derived footprints with explicit AS-IS/reference status;
4. permitted third-party derived footprints with provenance/license metadata;
5. contextual reference geometry.

Apple building presentation is not part of this hierarchy and must not be extracted into it.

## Roads

Keep transportation geometry separate from Apple navigation context, engineering alignments, hydraulic conveyance geometry, and temporary construction proposals.

## Terrain

Use authoritative LiDAR/DEM sources to produce TSM terrain. Store horizontal CRS and vertical datum independently. Never infer a vertical datum from a visual map.

The renderer may support terrain LOD, normal maps, mesh decimation, occlusion, frustum culling, HLOD, 3D Tiles, WebGPU PBR, and water/atmosphere.

## Hydrology

A water surface is generated from current authoritative observations/model outputs and explicit datum transformations. It is never hard-coded as a universal project value.

Every live observation carries source, station, observed time, received time, qualifier/freshness, native datum, conversion metadata, and evidence/signature state.

## Presentation modes

Expose:
- TSM_TWIN
- APPLE_CONTEXT
- APPLE_STREET
- TSM_WITH_APPLE_CONTEXT
- EVIDENCE

EVIDENCE suppresses non-authoritative visual interpretation.

## Camera

Keep camera state provider-neutral: WGS84 latitude/longitude, heading, pitch, distance, target feature, and viewport mode.

Do not encode Apple-specific geometry into TSM data models.

## Failure behavior

If Apple is unavailable, TSM authoritative maps continue operating; TSM 3D twin continues operating; TSM evidence remains available; Look Around becomes unavailable; no Apple data is fabricated.

If TSM authoritative data is unavailable, do not silently promote Apple presentation into evidence.

## Engineering safety

Cinematic terrain, photorealistic buildings, Apple imagery, Look Around, Gaussian splats, and procedural scenes are presentation aids. They must never automatically establish parcel ownership, surveyed boundaries, flood elevations, no-rise compliance, hydraulic capacity, structural adequacy, or regulatory approval.
