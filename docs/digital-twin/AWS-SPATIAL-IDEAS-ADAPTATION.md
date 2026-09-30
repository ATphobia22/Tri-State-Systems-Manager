# AWS Spatial Ideas Adaptation — TSM

**Date:** 2026-09-30  
**Status:** Implemented as vendor-neutral architecture guidance

## Objective

TSM adopts the useful architectural patterns represented by the supplied AWS material while keeping the runtime **vendor-neutral, local-first and evidence-governed**.

### 1. Map tile fabric

Amazon Location demonstrates a clean separation between a renderer, style descriptors, tile APIs and static-map generation. TSM maps that pattern to **MapLibre + local/controlled tile origins + PMTiles/Martin**, with the source registry remaining authoritative for provenance.

TSM should expose four conceptual base-map modes:

- Street/context
- Monochrome engineering canvas
- Imagery/hybrid
- Offline/local authoritative basemap

Each mode is a style selection, not a change in engineering authority.

### 2. 3D asset streaming

The AWS IoT TwinMaker glTF → 3D Tiles workflow reinforces the existing TSM direction: large models should not be loaded as one monolithic GLB. Convert/validate them offline, partition spatially, and stream only visible hierarchy nodes. AWS describes HLOD and spatially bounded streaming as the mechanism for improving load time and frame rate; its example reports a substantial size reduction after tiling. TSM implements the same principle with `3d-tiles-renderer`, an explicit tile manifest and an offline conversion/validation boundary.

### 3. Layered engineering visualization

Quick's base-map and layer-map concepts map cleanly onto TSM's existing layer catalog. A TSM layer stack should distinguish:

1. base map
2. terrain
3. current imagery
4. cadastral/context
5. hydrology
6. regulatory flood layers
7. engineering/model layers
8. historical evidence
9. simulation results

Opacity, visibility and styling are presentation state. Authority class and provenance are immutable metadata.

### 4. Deterministic spatial agents

The 2026 AWS spatial-agent example is particularly useful architecturally: deterministic orchestration owns the simulation loop; agents receive constrained world views and return structured decisions; a world-state service validates and atomically applies actions; snapshots are recorded for replay.

TSM should therefore use:

```text
Scenario → deterministic runner → agent/tool proposal → validator → world-state transaction → snapshot → renderer
```

The LLM/agent is **not** the simulator and never writes directly to authoritative state.

### 5. Cinematic renderer lessons

The Lumberyard Atom material is used as a rendering-design reference rather than as a dependency. The relevant ideas are modular PBR materials, GPU-aware rendering, physically based lighting, ray tracing where hardware permits, and a renderer designed around extensibility. TSM's browser surface remains MapLibre/Three/WebGPU; the native cinematic surface can use Unreal/OpenUSD without contaminating evidence or solver code.

## TSM target architecture

```text
                    ┌─────────────────────────────┐
                    │      SOURCE / EVIDENCE       │
                    │ USGS · FEMA · IN DNR · NOAA │
                    └──────────────┬──────────────┘
                                   │ provenance
                    ┌──────────────▼──────────────┐
                    │       DATA / TILE FABRIC    │
                    │ PostGIS · COG · PMTiles     │
                    │ MVT · Terrain-RGB · 3DTiles │
                    └──────────────┬──────────────┘
                                   │ contracts
              ┌────────────────────▼────────────────────┐
              │             SPATIAL RUNTIME             │
              │ MapLibre · Three · 3D Tiles · WebGPU   │
              └──────────────┬──────────────┬───────────┘
                             │              │
                    ┌────────▼──────┐ ┌────▼──────────┐
                    │ SIMULATION     │ │ AGENT TOOLS   │
                    │ deterministic  │ │ MCP-compatible│
                    │ solver kernel  │ │ constrained   │
                    └────────┬───────┘ └────┬──────────┘
                             └───────┬──────┘
                                     ▼
                           validated world state
                                     │
                           immutable snapshots
                                     │
                           ┌─────────▼─────────┐
                           │ HUMAN REVIEW / UI │
                           └───────────────────┘
```

## Source material

- AWS Amazon Location maps and tiles documentation
- AWS IoT TwinMaker glTF/3D Tiles technical guidance
- AWS Physical AI spatial-agent simulation architecture
- AWS Lumberyard Atom renderer architecture article
- AWS Quick base-map/layer-map/geospatial-chart documentation
- AWS IoT TwinMaker sample repositories and dynamic-scene sample

These are **design references**, not TSM dependencies or authority sources.
