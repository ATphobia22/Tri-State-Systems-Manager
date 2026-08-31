# OpenUSD Hydra delegates — TSM visualization plane

Hydra separates **scene description (USD)** from **render backends** (render delegates).

## Core pieces

| Piece | Role |
|-------|------|
| Scene delegate | Feeds prims / materials into Hydra |
| Render index | Tracks change processing |
| Render delegate | Produces pixels (GPU/CPU path tracer or rasterizer) |

## Stock / common delegates

| Delegate | Character | TSM use |
|----------|-----------|---------|
| **HdStorm** | Real-time raster (OpenGL, Metal, experimental **Vulkan** via Hgi) | Interactive EOC / usdview |
| **HdEmbree** | CPU ray tracer (limited materials) | Offline reference / CI snapshots |
| **HdTiny** | Minimal example | Tests only |
| Third-party | Arnold, RenderMan, etc. | Film path if licensed |

OpenUSD **24.08+**: HgiVulkan experimental for Storm (Windows/Linux/Android). Enable via environment (`HGI_ENABLE_VULKAN`) where supported; treat as non-authoritative for regulatory evidence.

## TSM rules

1. USD export (`tools/ptdt_archimedes_usd_coupler.py`) is **VISUALIZATION / SIMULATION_DEMO** unless bound to sealed EvidenceArtifact hashes.
2. Hydra/Storm does **not** replace HEC-RAS or FEMA BFE.
3. Prefer exporting **metadata prims** (`tsm:contentHash`, `tsm:authorityClass`) on stage root.
4. Browser EOC remains **Three.js / MapLibre**; Hydra is offline / desktop virtual-production path.

## Suggested stage attributes

```
custom string tsm:authorityClass = "VISUALIZATION"
custom string tsm:horizontalCrs = "EPSG:2966"
custom string tsm:verticalDatum = "NAVD88"
custom double tsm:bfeFt = 375.0
custom double tsm:lagFt = 377.2
custom string tsm:contentHashSha256 = "..."
```

