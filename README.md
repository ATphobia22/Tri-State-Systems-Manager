# Tri-State Systems Manager (TSM)

**An open-source geospatial engineering and decision-support platform for the Ohio–Wabash River Valley (Indiana, Illinois, Kentucky).**

TSM integrates public hydrology, terrain, imagery, flood-hazard data, infrastructure context, and engineering models into a reviewable workspace for communities, public agencies, and engineering teams. Every dataset carries its provenance: source identity, acquisition date, coordinate reference system, vertical datum, and review status.

**Personal dedication:** This project is dedicated to the memory of Beverly Ann Tucker. The dedication is personal and is not a software specification, architecture constraint, or release gate.

**GitHub:** https://github.com/ATphobia22/Tri-State-Systems-Manager

---

## Live Artifacts

| Artifact | Link | Description |
|----------|------|-------------|
| **TSM Dashboard** | https://muse.ai/s/tri-state-systems-manager-dashboard-txp6c9xxxctmkf | Project status, engineering updates, flood forecasting toolkit |
| **TSM Console** | https://muse.ai/s/tsm-console-xsxh6nxg1xpy1xyo | Interactive console: river watch, flood forecast, 3D map, AI assistant, music |
| **Complete Song Album** | https://muse.ai/s/complete-song-album-xxx | Anthony's 13-song album — the soundtrack of the valley |

### GitHub Pages

- [Public console (SPA)](https://atphobia22.github.io/Tri-State-Systems-Manager/)
- [3D terrain viewer](https://atphobia22.github.io/Tri-State-Systems-Manager/terrain-3d/)
- [Platform capabilities](https://atphobia22.github.io/Tri-State-Systems-Manager/platform/)

---

## What TSM Does

- **River monitoring:** User-initiated USGS gage data retrieval; operational alerts and current values must be checked against the live source.
- **Flood forecasting:** Model integrations and scripts for forecast horizons that depend on the selected model, available inputs, and successful upstream retrieval.
- **3D visualization:** MapLibre-based 3D buildings, terrain, LiDAR point clouds, and flood zones.
- **Data integration:** Government and open-data source adapters with provenance tracking; source availability and freshness are runtime properties, not guaranteed by adapter presence.
- **Decision support:** Scenario analysis, antecedent conditions, and plain-language summaries for review by people with the relevant authority.

### What TSM Is Not

TSM is decision-support software — not a surveying instrument, not a certified digital twin, not a licensed engineering service, not a regulatory determination, and not an emergency warning system. A layer appearing in a visualization does not make it survey-grade. Missing data is labeled as missing, never invented.

### Incomplete technical gaps (must not be claimed complete)

Authoritative registry: [`docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md`](docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md). A capability is not production-complete merely because code or a proof of concept exists. Release gates are technical acceptance checks; unavailable inputs should surface as explicit degraded/unavailable states, while invalid or unverified scientific outputs must never be represented as valid.

| Item | Current evidence-based status |
|------|-------------------------------|
| Hierarchical-Z / GPU compute culling | **Not complete.** CPU depth-pyramid work and WebGL2 occlusion queries exist; production GPU H-Z/WebGPU compute integration and live-scene validation remain open. |
| Transvoxel terrain stitching | **Partial.** Lengyel transition-cell classification tables and stitcher integration exist; county-scale mesh emission, seam validation, and production terrain coverage remain unverified. |
| Full C/S adaptive streaming | **Partial.** Resource lifecycle and bandwidth-adaptive fetch logic are wired into the frame fetch bridge; complete AOI asset coverage and end-to-end runtime validation remain open. |
| System-wide coordinate/datum/epoch/survey validation | **Partial.** Evidence products and local guards exist; full catalog batch validation and a committed coverage report are still required. |
| Multi-device occlusion profiling | **Not complete.** Context-loss recovery and CPU-side tooling exist; representative hardware profiles and performance evidence are missing. |
| Nanite-style meshlet path | **Advanced scaffold, not production Nanite.** GLB extraction, meshlet import/culling, and pilot bake paths exist; the full continuous LOD DAG, CI bake path, live-scene depth integration, and browser WebGPU CI validation remain open. |

See the [finishing-touch inventory](docs/validation/FINISH-TOUCHES-2026-10-19.md) for the recent implementation inventory and remaining limitations.

---

## Government Data Sources

### Federal

| Source | Data Used | Access |
|--------|-----------|--------|
| **USGS** (U.S. Geological Survey) | Stream gages (NWIS), 3DEP elevation (1m DEM, LiDAR point clouds via EPT), National Map products | Public API, S3 |
| **NOAA** (National Oceanic and Atmospheric Administration) | CPC precipitation (daily gauge analysis), NWS flood stages, weather forecasts | Public FTP/API |
| **FEMA** (Federal Emergency Management Agency) | NFHL (National Flood Hazard Layer), FIRM panels, LOMA cases | MapServer, MSC |
| **USACE** (U.S. Army Corps of Engineers) | National Levee Database (NLD), hydraulic models, eHydro surveys | Public REST API |
| **U.S. Census Bureau** | TIGER/Line (roads, water, boundaries) | Public download |
| **USDA** (Dept. of Agriculture) | NAIP imagery, SSURGO soils, CDL cropland | Public download |
| **NASA** | Earthdata (Landsat, MODIS, GPM IMERG), Crisis Mapping Toolkit patterns | Earthdata API |
| **EPA** | EnviroAtlas, PRISM climate normals | Public download |

### State — Indiana

| Source | Data Used |
|--------|-----------|
| **Indiana DNR** | Best Available Floodplain Mapping, hydraulic model library (HEC-RAS) |
| **Indiana GIO** | Statewide LiDAR/DEM (2020), imagery (1970–2025) via AWS S3 |
| **IDNR Division of Water** | FARA floodplain analysis reports |

### State — Illinois & Kentucky

| Source | Data Used |
|--------|-----------|
| **Illinois State Geological Survey** | Elevation data via USGS 3DEP |
| **Kentucky From Above** | 2ft DEM (Henderson, Union counties) via S3 |

### International / Academic

| Source | Data Used |
|--------|-----------|
| **ECMWF** | GEOGloWS v2 global streamflow forecasts |
| **Google Research** | OpenHydroNet, TimesFM, WeatherNext 2 (availability/licensing must be checked for the chosen deployment) |
| **dClimate / U. Cambridge** | TESSERA satellite embeddings |
| **Overture Maps Foundation** | Global building footprints (ODbL) |
| **Microsoft** | Global ML Building Footprints (validation) |

---

## Map Sources & Basemaps

| Source | Type | Used For |
|--------|------|----------|
| **OpenFreeMap** | Vector tiles | Default basemap (no API key) |
| **MapLibre GL** | Rendering engine | Interactive maps |
| **USGS National Map** | Raster tiles | Topographic basemap option |
| **IndianaMap** | ArcGIS REST | Indiana imagery and parcels |
| **PMTiles** | Vector tiles | Self-hosted building/parcel layers |
| **3D Tiles 1.1** | 3D geospatial | Buildings, terrain meshes |
| **Terrarium** | Raster DEM tiles | Elevation visualization; verify source, resolution, and vertical semantics before analysis |
| **Potree / EPT** | Point clouds | LiDAR visualization |

---

## Key Capabilities (October 2026)

### Flood Forecasting Toolkit (`scripts/flood-forecasting/`)

The repository contains a multi-step forecasting pipeline with ingestion, antecedent precipitation, nowcasting, forecasting, rating, and alert stages. The following files are part of that pipeline; their presence does not itself prove a successful, current forecast run.

| Script | Function |
|--------|----------|
| `run_all.py` | Master orchestrator: ingest → antecedent → nowcast → forecast → rating → alert |
| `tsm_config.py` | Shared configuration (gages, bounding boxes, paths) |
| `timesfm-gage-nowcast.py` | TimesFM-based nowcasting path (0–48h design horizon; verify model/runtime availability) |
| `geoglows_forecast.py` | GEOGloWS v2 forecast integration (10-day design horizon; verify live service response and station mapping) |
| `tsm-tristate-openhydronet-config.yml` | OpenHydroNet basin configuration |
| `antecedent_precip.py` | Antecedent Precipitation Index from NOAA CPC data |
| `tessera-tristate-download.py` | TESSERA satellite embeddings via Icechunk |
| `weathernext-forcing.py` | WeatherNext forcing integration |
| `ras2fim_tristate.py` | HEC-RAS to flood inundation mapping |
| `tsm_usgs_ingest.py` | USGS data ingestion wrapper |
| `tsm_usgs_lidar_ept.py` | USGS 3DEP LiDAR via Entwine Point Tiles |
| `tnm_bulk_download.py` | National Map bulk downloader |
| `earthdata_tristate.py` | NASA Earthdata search/download |
| `prepare-static-attributes.py` | Basin static attributes for modeling |

**Operational-status rule:** No current precipitation condition, gage value, forecast, alert, or source-availability claim is made by this README. Check the live source and runtime health at the time of use; record observation time, source URL/identifier, units, datum, quality flags, and model version with any operational report.

### 3D & Geospatial

- **Building inventory:** Counts and classifications are versioned data products; verify the current manifest and provenance before quoting counts as current.
- **LOD2 geometry:** Roof geometry is a derived data product and requires coverage and quality checks before engineering use.
- **LOD2 AI automation** (`scripts/geospatial/lod2-ai-automation.py`): SAT2LOD2/HEAT integration guide.
- **RTC transforms** (`tsm-console/src/lib/rtc-transform.ts`): 3D Tiles precision handling.
- **State-word WebGIS** (`tsm-console/src/lib/state-word-webgis.ts`): 16-bit decoders for MapLibre/Three.js.
- **WebGPU terrain** (`tsm-console/src/lib/webgpu-volumetric-terrain.ts`): GPU marching-cubes implementation; runtime/device support and numerical validation are separate acceptance gates.
- **PBR baking** (`scripts/3d-tiles/bake-pbr-standard.py`): Headless Blender standardization.
- **Elevation evidence product** (`tsm-console/src/lib/elevation-evidence-product.ts`): CRS / vertical datum / epoch / accuracy class — required before survey claims.
- **Tile resource lifecycle** (`tsm-console/src/lib/tile-resource-lifecycle.ts`): status machine and bounded release; synthetic tiles are not authoritative evidence.

### Console Features

The console presents navigation and tools for project overview, river data, forecast workflows, 3D mapping, the offline assistant, data sources, tools, build workflows, and project information. Treat each view as a user interface to a workflow, not as proof that upstream data, inference, or an engineering computation succeeded.

---

## Architecture Principles

1. **Human authority is non-negotiable.** Technology informs; people decide.
2. **Evidence over theater.** Real data with provenance, or honest "unavailable."
3. **Authority classes stay separate.** OBSERVED ≠ DERIVED ≠ SCENARIO ≠ REGULATORY.
4. **Open source (Apache-2.0).** Prefer reproducible, freely accessible tooling; verify each dependency's license and any hosted service's usage limits.
5. **Local-first.** Design for offline operation and USB deployment where the workflow's data and dependencies have been acquired; offline mode cannot conjure unavailable live inputs.
6. **Problems surface with visible badges** — missing evidence is labeled, never invented as survey truth.

---

## Quick Start

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager
# Console (Node.js 22+)
cd tsm-console && npm ci && npm run dev
# Flood forecasting — first inspect the runbook/config and available data/model dependencies.
cd ../scripts/flood-forecasting && python3 run_all.py --step all
```

The forecasting command may acquire data, require network access, or run model stages with external prerequisites. Review its options and configuration before a production run; a successful command is not a substitute for scientific validation.

---

## Key Gages

| Site | Location | Station / land-surface altitude | Stage thresholds |
|------|----------|----------------------------------|------------------|
| USGS 03381700 | Ohio River at Old Shawneetown, IL-KY | 309.10 ft NAVD88 (station altitude; not a gage-zero offset) | Action 30 ft; minor 33 ft; moderate 43 ft; major 53 ft (gage height) |
| USGS 03378500 | Wabash River at New Harmony, IN | 352.71 ft NAVD88; published historical metadata also lists 353.07 ft NGVD29 | Action 10 ft; minor 15 ft; moderate 20 ft; major 23 ft (gage height) |
| NWS MTVI3 | Ohio River at Mount Vernon, IN | No verified gage-zero conversion recorded here | 35 ft (stage threshold; verify current NWPS metadata) |

**Datum rule:** Station altitude is not gage-zero datum. Raw USGS parameter 00065 is gage height on source gage datum. TSM does not infer NAVD88 water-surface elevation from station altitude. A candidate 352.67 ft NAVD88 gage-zero relationship for USGS 03378500 remains unpublished in TSM pending product-semantic review. Sources: [USGS 03381700](https://waterdata.usgs.gov/monitoring-location/USGS-03381700/), [USGS 03378500](https://waterdata.usgs.gov/monitoring-location/USGS-03378500/).

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

## Disclaimer

TSM is public-interest decision-support software. It does not replace licensed survey, engineering, or regulatory determinations. Always verify critical elevations and flood determinations against official FEMA/IDNR/USACE products and qualified professionals.
