# Tri-State Systems Manager (TSM)

**An open-source, evidence-governed geospatial decision-support platform for the Ohio–Wabash River Valley (Indiana, Illinois, Kentucky).**

TSM integrates public hydrology, terrain, imagery, flood-hazard data, infrastructure context, and engineering models into a reviewable workspace for communities, public agencies, and engineering teams. Every dataset carries its provenance: source identity, acquisition date, coordinate reference system, vertical datum, and review status.

> **Operating principle:** Technology informs people; it does not silently govern people. Human authority remains final.

**In memory of Beverly Ann Tucker.** This work is guided by the Beverly Ann Tucker Memorial Stewardship Charter and the God's Love Protocol.

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

- **River monitoring:** Live USGS gage levels with flood-stage alerts (user-initiated fetch, no auto-polling)
- **Flood forecasting:** Multi-model pipeline (TimesFM, GEOGloWS v2, OpenHydroNet) with 2-day to 10-day horizons
- **3D visualization:** MapLibre-based 3D buildings, terrain, LiDAR point clouds, and flood zones
- **Data integration:** 30+ government and open data sources with full provenance tracking
- **Decision support:** Scenario analysis, antecedent conditions, and plain-language summaries for all ages

### What TSM Is Not

TSM is decision-support software — not a surveying instrument, not a certified digital twin, not a licensed engineering service, not a regulatory determination, and not an emergency warning system. A layer appearing in a visualization does not make it survey-grade. Missing data is labeled as missing, never invented.

### Incomplete technical gaps (must not be claimed complete)

Full registry: [`docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md`](docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md)

| Item | Status |
|------|--------|
| Hierarchical-Z / GPU compute culling | Not complete (WebGL2 occlusion queries only) |
| Transvoxel terrain stitching | PoC + density contract + 2:1 LOD scheduler; not production Lengyel tables |
| Full C/S adaptive streaming | Logic + fetch bridge; bandwidth-adaptive path incomplete |
| System-wide coordinate/datum/epoch/survey validation | Partial (local math + guards; not all features) |
| Multi-device occlusion profiling | Partial (context-loss recovery exists) |

---

## Government Data Sources

### Federal

| Source | Data Used | Access |
|--------|-----------|--------|
| **USGS** (U.S. Geological Survey) | Stream gages (NWIS), 3DEP elevation (1m DEM, LiDAR point clouds via EPT), National Map products | Public API, S3 |
| **NOAA** (National Oceanic and Atmospheric Administration) | CPC precipitation (daily gauge analysis), NWS flood stages, weather forecasts | Public FTP/API |
| **FEMA** (Federal Emergency Management Agency) | NFHL (National Flood Hazard Layer), FIRM panels, LOMA cases | MapServer, MSC |
| **USACE** (U.S. Army Corps of Engineers) | National Levee Database (NLD), HEC-RAS models, eHydro surveys | Public REST API |
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
| **Google Research** | OpenHydroNet, TimesFM, WeatherNext 2 (open source) |
| **dClimate / U. Cambridge** | TESSERA satellite embeddings |
| **Overture Maps Foundation** | Global building footprints (ODbL) |
| **Microsoft** | Global ML Building Footprints (validation) |

---

## Map Sources & Basemaps

| Source | Type | Used For |
|--------|------|----------|
| **OpenFreeMap** | Vector tiles | Default basemap (no API key) |
| **MapLibre GL** | Rendering engine | All interactive maps |
| **USGS National Map** | Raster tiles | Topographic basemap option |
| **IndianaMap** | ArcGIS REST | Indiana imagery and parcels |
| **PMTiles** | Vector tiles | Self-hosted building/parcel layers |
| **3D Tiles 1.1** | 3D geospatial | Buildings, terrain meshes |
| **Terrarium** | Raster DEM tiles | Elevation contours |
| **Potree / EPT** | Point clouds | LiDAR visualization |

---

## Key Capabilities (October 2026)

### Flood Forecasting Toolkit (`scripts/flood-forecasting/`)

14 scripts implementing a full forecasting pipeline:

| Script | Function |
|--------|----------|
| `run_all.py` | Master orchestrator: ingest → antecedent → nowcast → forecast → rating → alert |
| `tsm_config.py` | Shared configuration (gages, bounding boxes, paths) |
| `timesfm-gage-nowcast.py` | TimesFM 3.0 zero-shot forecasting (0–48h) |
| `geoglows_forecast.py` | GEOGloWS v2 operational forecasts (10-day) — 3 rivers configured |
| `tsm-tristate-openhydronet-config.yml` | OpenHydroNet basin configuration |
| `antecedent_precip.py` | Antecedent Precipitation Index from NOAA CPC data |
| `tessera-tristate-download.py` | TESSERA satellite embeddings via Icechunk |
| `weathernext-forcing.py` | WeatherNext 2 meteorological forcing |
| `ras2fim_tristate.py` | HEC-RAS to flood inundation mapping |
| `tsm_usgs_ingest.py` | USGS data ingestion wrapper |
| `tsm_usgs_lidar_ept.py` | USGS 3DEP LiDAR via Entwine Point Tiles |
| `tnm_bulk_download.py` | National Map bulk downloader |
| `earthdata_tristate.py` | NASA Earthdata search/download |
| `prepare-static-attributes.py` | Basin static attributes for modeling |

**Operational status:**
- ✅ GEOGloWS: 3 rivers configured (IDs verified via API)
- ✅ Antecedent precipitation: Real NOAA CPC data (currently DRIER THAN NORMAL)
- ✅ USGS ingestion: Live gage data via NWIS

### 3D & Geospatial

- **22,815 buildings** with heights (11,624 observed, 10,008 NDHM-derived, 1,183 derived)
- **7,453 LOD2** buildings with roof geometry
- **LOD2 AI automation** (`scripts/geospatial/lod2-ai-automation.py`): SAT2LOD2/HEAT integration guide
- **RTC transforms** (`tsm-console/src/lib/rtc-transform.ts`): 3D Tiles precision handling
- **State-word WebGIS** (`tsm-console/src/lib/state-word-webgis.ts`): 16-bit decoders for MapLibre/Three.js
- **WebGPU terrain** (`tsm-console/src/lib/webgpu-volumetric-terrain.ts`): GPU marching cubes
- **PBR baking** (`scripts/3d-tiles/bake-pbr-standard.py`): Headless Blender standardization
- **Elevation evidence product** (`tsm-console/src/lib/elevation-evidence-product.ts`): CRS / vertical datum / epoch / accuracy class — required before survey claims
- **Tile resource lifecycle** (`tsm-console/src/lib/tile-resource-lifecycle.ts`): status machine + bounded release (no synthetic tiles)

### Console Features

The TSM Console (10 tabs) provides:
- 🏠 Home — Project overview
- 🌊 River Watch — Live gage levels with flood alerts
- 🔮 Flood Forecast — Multi-model predictions in plain language
- 🗺️ 3D Map — Interactive MapLibre visualization
- 🤖 Ask TSM — Offline AI assistant
- 📊 Data Sources — Every source explained simply
- 🛠️ Tools — All scripts described without jargon
- 🔗 Build — Visual pipeline builder (ComfyUI-inspired)
- 🎵 Music — Complete 13-song album
- 💛 About — Memorial dedication and charter

---

## Architecture Principles

1. **Human authority is non-negotiable.** Technology informs; people decide.
2. **Evidence over theater.** Real data with provenance, or honest "unavailable."
3. **Authority classes stay separate.** OBSERVED ≠ DERIVED ≠ SCENARIO ≠ REGULATORY.
4. **Open source (Apache-2.0).** No lock-in, no token gates.
5. **Local-first.** Runs offline, USB-deployable, air-gappable.
6. **Problems surface with visible badges** — missing evidence is labeled, never invented as survey truth.

---

## Quick Start

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager
# Console
cd tsm-console && npm install && npm run dev
# Flood forecasting
cd scripts/flood-forecasting && python3 run_all.py --step all
```

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
