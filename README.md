# Tri-State Systems Manager (TSM)

**An open-source geospatial engineering and decision-support platform for the Ohio–Wabash River Valley (Indiana, Illinois, Kentucky).**

TSM integrates public hydrology, terrain, imagery, flood-hazard data, infrastructure context, and engineering models into a reviewable workspace for communities, public agencies, and engineering teams. Every dataset carries its provenance: source identity, acquisition date, coordinate reference system, vertical datum, and review status.

> **Operating principle:** Technology informs people; it does not silently govern people. Human authority remains final.

**In memory of Beverly Ann Tucker.** *This dedication is personal and is not a software specification, architecture constraint, or release gate.*

**GitHub:** https://github.com/ATphobia22/Tri-State-Systems-Manager
**Live site:** https://atphobia22.github.io/Tri-State-Systems-Manager/
**3D story:** [Tri-State Systems Manager — Ohio-Wabash Confluence](https://ion.cesium.com/stories/viewer/?id=82d4a592-c33e-4239-86d5-d53c329a7f7f) (Cesium ion)
*The hosted story is an optional presentation reference; the self-hosted/offline viewer does not require a Cesium ion account or token.*

**Open-source engineering stack:** [Integration plan](docs/OPEN-SOURCE-ENGINEERING-INTEGRATION-PLAN.md) · [Engine registry](integrations/open-source-engine-registry.json)

---

## Live Artifacts

Public, no-expiration companion pages:

| Artifact | Link | Description |
|----------|------|-------------|
| **TSM Dashboard** | https://muse.ai/s/tri-state-systems-manager-dashboard-txp6c9xxxctmkf/BiZgScbiemuiBiQSXXjED4ulVUxZIjLWgARYdGRzLwI | Project status, engineering updates, flood forecasting toolkit |
| **TSM Mission Control** | https://muse.ai/s/tsm-mission-control-jxf6qi3axqxpdxp/HruMwn8Fpn4X2jtkeKyaTyX9MfLK6h0zv-gAdd1bILE | Operations overview |
| **TSM Evidence Workbench** | https://muse.ai/s/tsm-evidence-workbench-uxl6qhxwvlxtgxa/q7Y8j3P-cijwXGVD93ygymQPZgeGq5bbxoxxjrstAas | Evidence review workspace |
| **TSM Flood Ops** | https://muse.ai/s/tsm-flood-ops-xlw6qic7xnbxb7/TH2KsOXt2k2FFBNhfuUQergOoy5Sxy_3xytg82FIpHM | Flood operations view |
| **TSM Model Lab** | https://muse.ai/s/tsm-model-lab-xkr6qhxxdzd5xw/9uESU_ZtW-BNFUZNLBHTs30cPi8qHl8EuA6ICLpNFzg | Model experimentation |
| **TSM Console** | https://muse.ai/s/tsm-console-xsxh6nxg1xpy1xyo/6cvHgHoXKVEwDjTQnPxc-0tT8DpsJx614Hj5k9LrxUE | Interactive console snapshot |
| **TSM Source Master Inventory** | https://muse.ai/s/tsm-government-mapping-source-master-ct6idl9wxvlxe/T-JSIwvRkX1HZcDEPdvSP9hrBiugRPkI4yaJsF081kI | Government & mapping source catalog (26 sections) |
| **Complete Song Album** | https://muse.ai/s/complete-song-album-xuxq6cxhxhxyzxhpxu/e9AFx0tZBnQAAIPwvxrMMnzAasQSNKHWBoFPxc2sc_U | Anthony's 13-song album — the soundtrack of the valley |

### GitHub Pages (live, builds from `main`)

- [Public console (SPA)](https://atphobia22.github.io/Tri-State-Systems-Manager/)
- [3D Twin — engineering + photorealistic](https://atphobia22.github.io/Tri-State-Systems-Manager/digital-twin-v2/)
- [Photorealistic 3D globe](https://atphobia22.github.io/Tri-State-Systems-Manager/photorealistic-3d/)
- [3D terrain viewer](https://atphobia22.github.io/Tri-State-Systems-Manager/terrain-3d/)
- [Platform capabilities](https://atphobia22.github.io/Tri-State-Systems-Manager/platform/)

---

## What TSM Does

- **River monitoring:** User-initiated USGS gage data retrieval (NWIS) and NOAA NWPS gauge queries; operational alerts and current values must be checked against the live source. No background polling — live values only on user request.
- **Flood forecasting:** Multi-step pipeline (`scripts/flood-forecasting/`): ingest → antecedent precipitation → nowcast → forecast → rating → alert. Includes a working TimesFM path (verified live 12-hour forecasts) and GEOGloWS v2 integration. Model outputs are labeled with their provenance; a pipeline existing does not prove a current forecast run.
- **Unified 3D Twin:** One "3D Twin" view with two modes. *Engineering Twin* (MapLibre, offline-first): the project's own 22,815 buildings with heights, 3DEP terrain, flood zones and layers. *Photorealistic* (Cesium ion, opt-in, free Community tier): Google Photorealistic 3D Tiles covering all eight counties. The engineering twin is the default; nothing 3D is ever gated behind the ion token.
- **3D story:** A public Cesium ion story presenting the Ohio–Wabash confluence and eight-county coverage (linked above).
- **Government data fabric:** 28-source registry with resilient adapters, hash-chained provenance, and local holdings. SSURGO soils for all 8 counties served hash-verified from local holdings; NFHL flood zones served from verified local GeoJSONs; NWPS/NWIS adapters with pinned snapshots. Missing data is labeled `UNAVAILABLE`, never invented.
- **3D visualization:** MapLibre-based 3D buildings, terrain, LiDAR point clouds (EPT), flood zones, Transvoxel terrain stitching (verified against the reference implementation).
- **Decision support:** Scenario analysis, antecedent conditions, benefit engine, and plain-language summaries for review by people with the relevant authority.
- **Data integration:** Government and open-data source adapters with provenance tracking; source availability and freshness are runtime properties, not guaranteed by adapter presence.

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

See the [finishing-touch inventory](docs/validation/FINISH-TOUCHES-2026-10-19.md) for the recent implementation inventory and remaining limitations. The [technical release-gate contract](docs/architecture/TECHNICAL-RELEASE-GATES.md) documents `StationDatumVerifier` and `HECReleaseGateChecker`, including the limits of what automated evidence checks can establish. The [Engineering Assurance Standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md) defines evidence classes, provenance requirements, numerical validation levels, release acceptance checks, and community-facing communication requirements.

---

## What's Next (roadmap — plans, not promises)

Near-term work, in rough order:

1. **23,082-feature acceptance chain** — resolve the schema drift between the deliverable files and the strict chain validator (align the validator to the files, or regenerate the files), then run the full acceptance chain.
2. **LOD2 production run** — emit full LOD2 roof geometry for the 7,453-building production set (proof of concept only, so far).
3. **County-scale Transvoxel** — run full mesh emission at AOI scale with seam validation.
4. **Bathymetry & sediment** — cheapest first step if authorized: Tinfour TINs from USACE eHydro soundings (assessment complete; no integration authorized yet).
5. **GPU/device validation** — Hierarchical-Z on real hardware and multi-device occlusion profiling (needs a device lab).
6. **Grant submissions** — FY2026 FEMA Flood Mitigation Assistance is open (up to $400M, applications due 2027-02-26); USACE §205 is the most direct path for levee/berm work. No submission without explicit per-submission authorization.
7. **LOMA case 26-05-2022A support** — evidence packages for the 90-day FEMA track (ends 2026-12-21); still needs recorded deed/plat, tax assessor map, and PE/RLS-certified elevation.
8. **Union County KY parcels** — via the county PVA (requires owner authorization to contact).
9. **Release distribution** — TSM data releases ship on Google Drive (never temporary links), chunked for offline/USB deployment.

---

## Government Data Sources

### Federal

| Source | Data Used | Access |
|--------|-----------|--------|
| **USGS** (U.S. Geological Survey) | Stream gages (NWIS), 3DEP elevation (1m DEM, LiDAR point clouds via EPT), National Map products | Public API, S3 |
| **NOAA** (National Oceanic and Atmospheric Administration) | CPC precipitation (daily gauge analysis), NWS flood stages, NWPS gauge API, weather forecasts | Public FTP/API |
| **FEMA** (Federal Emergency Management Agency) | NFHL (National Flood Hazard Layer), FIRM panels, LOMA cases, FY2026 FMA NOFO | MapServer, MSC |
| **USACE** (U.S. Army Corps of Engineers) | National Levee Database (NLD), hydraulic models, eHydro surveys | Public REST API |
| **U.S. Census Bureau** | TIGER/Line (roads, water, boundaries) | Public download |
| **USDA** (Dept. of Agriculture) | NAIP imagery, SSURGO soils (all 8 tri-state counties, locally held), CDL cropland | Public download |
| **NASA** | Earthdata (Landsat, MODIS, GPM IMERG), Crisis Mapping Toolkit patterns | Earthdata API |
| **EPA** | EnviroAtlas, PRISM climate normals | Public download |

Recently wired into the data fabric: SSURGO (Web Soil Survey direct download, hash-verified local holdings), NWPS + NWIS query adapters with pinned snapshots, and NFHL served from verified local GeoJSONs. Verified-live endpoints are recorded in `~/workspace/gov-data-downloads/manifest.json` (local); only probed/downloaded claims are adopted.

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
| **Google Research** | OpenHydroNet, TimesFM (live 12h forecasts verified), WeatherNext 2 (availability/licensing must be checked for the chosen deployment) |
| **dClimate / U. Cambridge** | TESSERA satellite embeddings |
| **Overture Maps Foundation** | Global building footprints (ODbL) |
| **Microsoft** | Global ML Building Footprints (validation) |

---

## Map Sources & Basemaps

| Source | Type | Used For |
|--------|------|----------|
| **OpenFreeMap** | Vector tiles | Default basemap (no API key) |
| **MapLibre GL** | Rendering engine | Interactive maps, engineering 3D twin |
| **Cesium ion** | 3D Tiles / stories | Opt-in photorealistic 3D globe + public story (free Community tier) |
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
| `timesfm-gage-nowcast.py` | TimesFM-based nowcasting path (0–48h design horizon; live 12h runs verified) |
| `geoglows_forecast.py` | GEOGloWS v2 forecast integration (10-day design horizon; verify live service response and station mapping) |
| `tsm-tristate-openhydronet-config.yml` | OpenHydroNet basin configuration |
| `antecedent_precip.py` | Antecedent Precipitation Index from NOAA CPC data |
| `tessera-tristate-download.py` | TESSERA satellite embeddings via Icechunk |
| `weathernext-forcing.py` | WeatherNext forcing integration |
| `ras2fim_tristate.py` | HEC-RAS to flood inundation mapping (resilient: honest UNAVAILABLE when the Windows-only toolchain can't run) |
| `tsm_usgs_ingest.py` | USGS data ingestion wrapper |
| `tsm_usgs_lidar_ept.py` | USGS 3DEP LiDAR via Entwine Point Tiles |
| `tnm_bulk_download.py` | National Map bulk downloader |
| `earthdata_tristate.py` | NASA Earthdata search/download |
| `prepare-static-attributes.py` | Basin static attributes for modeling |

**Operational-status rule:** No current precipitation condition, gage value, forecast, alert, or source-availability claim is made by this README. Check the live source and runtime health at the time of use; record observation time, source URL/identifier, units, datum, quality flags, and model version with any operational report.

### Open-source ecosystem review

- `docs/research/OPEN-SOURCE-ECOSYSTEM-ADOPTION-REVIEW.md` evaluates Apple open-source projects, open-source discovery portals, and relevant geospatial/hydrology libraries without treating popularity as evidence.
- `integrations/open-source-candidate-register.json` records candidate licenses, applicability, and explicit `not-integrated` status. PROJ, GDAL, and ECMWF earthkit-hydro are evaluation candidates; pysheds is flagged for GPL-3.0 distribution review.
- `npm run test:open-source-register` checks that candidates remain research-only until separate license, security, and engineering validation gates pass. No new geospatial runtime dependency was added.

### WWDC24 MapKit and Maps & Location review

- `docs/research/WWDC24-MAPKIT-AND-MAPS-LOCATION.md` records the official WWDC24 Place ID, Place Card, search, and Maps Embed findings alongside the separate status of forum reports.
- `schemas/apple-place-reference.schema.json` models Apple Place IDs as display/discovery references only. It explicitly prevents treating them as authoritative parcel, survey, hydrologic, or engineering evidence.
- `npm run test:apple-mapkit-reference` validates this boundary. No MapKit token or external Apple map dependency is configured.
- The hydrology stage fallback preserves `REQUIRES_VALIDATED_HYDRAULIC_PROFILE` and `NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER` even when live values are unavailable.

### Apple open-source reuse assessment and CI repairs

- `docs/research/APPLE-OPEN-SOURCE-REUSE-ASSESSMENT.md` reviews Apple Open Source, Pkl, FoundationDB, SwiftNIO, and Swift Collections. It records what is applicable to TSM and why Swift-only libraries are not added to the TypeScript runtime.
- `npm run test:npm-workspaces` checks that internal package dependencies use npm-compatible semver ranges and align with the local workspace versions.
- `tsm-console/src/lib/stage.ts` exports `unavailableStage()` for non-live loaders, returning null measurements and no network side effects.
- UACF workspace manifests now use version ranges instead of pnpm/yarn-only `workspace:*` syntax.

### Apple Developer Forums findings — applied guardrails

- `docs/integrations/APPLE-DEVELOPER-FORUMS-FINDINGS.md` records findings from Apple Developer Forums and official Apple networking/App Intents documentation, separating forum advice from normative API contracts.
- `integrations/apple-platform/apple-developer-forums-findings.json` records the implementation decisions and honest status for future native App Intents, heading quality metadata, geodesic coordinate calculations, and idempotency-aware retries.
- `schemas/compass-waypoint.schema.json` now supports optional heading accuracy, device orientation, and Core Location activity-context metadata. Missing accuracy remains unknown, and device compass data remains unauthorized for engineering use.
- `npm run test:apple-platform` validates these boundaries; the root `npm test` includes the focused contract suite.

### Apple Shortcuts — read-only hydrology snapshot

- `docs/integrations/APPLE-SHORTCUTS-READONLY-API.md` documents a user-triggered iPhone Shortcut using `GET /api/hydrologic/community`.
- `integrations/apple-shortcuts/tsm-shortcuts-api.json` defines the safe integration contract; automatic polling, mutations, embedded credentials, and unsupported OAuth flows are explicitly disallowed.
- `npm run test:apple-shortcuts-api` validates these boundaries. The shortcut must still be created and tested on-device; the repository does not claim an iCloud install or share link.

### Weather provenance and field waypoints

- **Apple Weather provider reference registry** (`integrations/weather-provider-reference.json`): records Apple's 19 listed weather providers, distinguishes attribution references from verified API access, and treats WeatherKit as a separate optional integration candidate.
- **Product-level weather provenance** (`docs/data-sources/APPLE-WEATHERKIT-AND-COMPASS-INTEGRATION.md`): requires provider/product IDs, source and validity timestamps, units, CRS/datum where applicable, licensing/attribution, payload hash, quality flags, and freshness state.
- **Compass waypoint contract** (`schemas/compass-waypoint.schema.json`): captures coordinate CRS, optional elevation and vertical datum, heading reference, capture method, timestamp, provenance, and review status. Device-compass points are context-only and are not authorized as survey, hydraulic-design, parcel-boundary, or regulatory evidence.
- **Validation**: `npm run test:weather-reference` checks registry uniqueness and core safety invariants. Registry presence does not imply a live provider, successful API call, or approved field observation.

### 3D & Geospatial

- **Unified 3D Twin** (`tsm-console/src/routes/UnifiedTwinView.tsx`): one "3D Twin" with Engineering Twin (MapLibre, offline-first) and Photorealistic (Cesium ion, opt-in) modes.
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

The TSM Console provides: Memorial, Trust Planes, River Watch (gage levels with flood context), Engineering Section, Human Needs, Evidence Ledger, Data Contracts, Benefit Engine, Hydraulic Map, Twin Canvas, 3D Twin (engineering + photorealistic modes), EOC Surface, Data Fabric, Flood Simulator, Globe (MapLibre), 3D Terrain (3DEP), Platform Capabilities — plus Ask TSM (offline assistant), build tools, and the 13-song album.

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


## Optional spatial data services

- **Dynamic parcel viewport queries:** `supabase/migrations/20261019194559_posey_parcel_bbox.sql` defines a bounded, RLS-protected PostGIS RPC. It returns only explicitly verified public records and never exposes owner names. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only after the intended Supabase project and parcel data licensing are verified.
- **Static polygon overlays:** the MapLibre PMTiles overlay is opt-in through `VITE_TSM_PMTILES_URL`, `VITE_TSM_PMTILES_SOURCE_LAYER`, and `VITE_TSM_PMTILES_ATTRIBUTION`. The hosted archive must support HTTP Range requests and CORS. Do not mark a layer published until the archive is built from validated data and hosted behavior is checked.
- **Build:** `python3 scripts/geospatial/build_pmtiles.py --input <validated.geojson> --output <archive.pmtiles> --name <source-layer>`; use `--allow-lossy-simplification` only for display layers where feature dropping is explicitly acceptable. `python3 -m unittest scripts.geospatial.test_build_pmtiles` exercises output/validation behavior without requiring Tippecanoe.
