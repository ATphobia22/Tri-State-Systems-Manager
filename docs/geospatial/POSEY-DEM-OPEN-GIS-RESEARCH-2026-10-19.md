# Posey County DEM, Open GIS Tooling, and Think GIS Capability Research

**Research date:** 2026-10-19  
**Scope:** Posey County, Indiana; lower Wabash–Ohio River mapping; terrain, flood evidence, public works, utilities, public safety, and reproducible offline GIS.  
**Status:** Source inventory and implementation recommendations. This document is not a claim that every external service is live or every data product has been downloaded.

## Executive findings

1. **The project already has a county DEM tile index, not a complete county DEM bundle.** `data/posey-county/elevation/posey-dem-tile-manifest-2020.json` records 581 tile URLs from Indiana GIO's 2016–2020 DEM footprint service (558 tiles dated 2020, 23 dated 2019 per the repository README). The manifest describes 2.5-foot pixels and Cloud-Optimized GeoTIFF assets. The current offline acquisition script retrieves the 3DEP lidar index and several county-scoped GIS products, but does not download every DEM raster tile. The large raster should be fetched selectively to an external/cache directory, hashed, and indexed in a receipt rather than checked into Git.
2. **The primary high-resolution source is Indiana's 2016–2020 hydro-flattened bare-earth DEM / QL2 lidar program**, distributed through IndianaMap/Indiana GIO and the countywide LiDAR portal. The USGS National Map Downloader and 3DEP provide complementary national elevation products. Keep source-native CRS, horizontal datum, vertical datum, units, pixel size, acquisition vintage, NoData, and processing lineage attached to each tile. Never infer vertical datum from a web map's display projection.
3. **FEMA NFHL is regulatory evidence; Indiana DNR flood products are state planning/regulatory context; terrain derivatives and scenario results are derived analysis.** Do not blend them into one “truth” layer. FEMA says NFHL represents current effective flood-hazard data, including effective maps and Letters of Map Change. The map UI should show source, effective date, scale/limitations, and layer authority.
4. **Think GIS is a proprietary commercial reference, not a code or asset source.** WTH's public pages and 2022 brochure describe responsive desktop/tablet/mobile GIS, customer-managed security, layer viewing/querying/analysis, field geometry/data editing, live situational-awareness data, and operational workflows for public safety, land information, public works, and utilities. Use only these public capability descriptions as requirements inspiration. Do not copy proprietary code, graphics, screenshots, database schemas, private services, or undocumented endpoints.
5. **QGIS, GRASS GIS, GDAL, and Overture provide practical open-source interoperability.** Use QGIS for human-operated GIS review and export; GRASS for hydrology/terrain raster processing; GDAL for raster inspection, warping, mosaics, COG creation and validation; and Overture only as contextual/community-derived vector data, not as surveyed or regulatory truth. gvSIG is another desktop option but should be evaluated against the current team workflow before adding a supported integration.

## Posey DEM sources and acquisition routes

| Source | What it supplies | TSM use | Acquisition / limitation |
|---|---|---|---|
| [IndianaMap DEM dataset](https://www.indianamap.org/search?tags=dem) | Indiana 2016–2020 hydro-flattened bare-earth DEM derived from statewide QL2 lidar | Primary county terrain, hillshade, contours, slope, drainage preprocessing | Use the checked-in Posey tile manifest to select only intersecting tiles. Do not assume the image service's Web Mercator display CRS is the source raster CRS. |
| [Indiana Elevation Program](https://elevation.gio.in.gov/) | State elevation program and public access routes | Source discovery and metadata | Verify product vintage and per-product metadata before using for design or regulatory calculations. |
| [Indiana DEM tile footprints](https://www.indianamap.org/maps/ff98e3834d464619bd5c8974b0038a13) | Footprints for tile-level availability | Select candidate tiles and identify coverage gaps | Footprints are an index, not elevation pixels. The repository manifest records 581 Posey-intersecting tile URLs from the 2016–2020 collection; re-query the live service before a new acquisition. |
| [IGIC Countywide LiDAR and DEM Tiles](https://www.igic.org/countywide-lidar-and-dem-tiles) / [Purdue distribution portal](https://lidar.digitalforestry.org/) | Indiana QL2 3DEP lidar and DEM discovery/download | Download source point cloud or derived raster when direct tile delivery is preferable | Confirm the selected release, metadata, license, CRS, vertical datum and point-cloud classification. The IGIC page references final 2016–2020 data and published metadata. |
| [USGS The National Map Downloader](https://apps.nationalmap.gov/downloader/) | 3DEP DEM and lidar, boundaries, imagery, hydrography, and topo products | Independent national coverage, gap-filling and cross-checks | Use the product-specific metadata; 3DEP products can differ in resolution, CRS and vertical datum. |
| [USGS 3DEP products](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) | National elevation product family, including lidar and DEM | Nationally consistent fallback/reference and provenance | The seamless 1-meter DEM can integrate inputs with differing coordinate systems, vertical datums, resolutions and dates. Do not treat a seamless mosaic as homogeneous source observations. |
| [AWS elevation-tiles-prod](https://registry.opendata.aws/terrain-tiles/) | Terrarium elevation tiles | Low-resolution basemap terrain / preview / graceful fallback | Existing TSM grid is explicitly screening-level and blends multiple source vintages/datums. Never substitute it for the Indiana 2.5-ft DEM or survey control. |

### DEM handling contract

- **Keep raw source tiles immutable.** Save to a user-selected acquisition/cache directory; record source URL, retrieval time, bytes, SHA-256, filename, source vintage, and validation results in a receipt.
- **Select by true tile footprint / AOI geometry**, not merely a bounding rectangle. Keep edge tiles if their footprints intersect the AOI, then clip/mosaic downstream against the exact Posey County polygon or a separately approved project AOI.
- **Inspect before processing:** use `gdalinfo -json` (or equivalent) to capture dimensions, geotransform, CRS, pixel size, band type, NoData, scale/offset, and metadata. Fail if metadata is missing or values are implausible; do not silently relabel CRS.
- **Preserve source elevation units and vertical datum.** A display CRS such as EPSG:3857 says nothing about vertical datum. Convert feet/metres numerically only with explicit units; a vertical-datum conversion requires an appropriate transformation grid/model and documented method, not a constant offset.
- **Mosaic only compatible data.** Group by compatible source vintage, resolution, horizontal CRS, vertical datum and elevation semantics. If reprojection/resampling is required, record the target grid, resampling method, software version and transformation.
- **Create derivatives separately:** hillshade, slope, aspect, contours, flow direction, flow accumulation, depression treatment, watershed boundaries and terrain-based screening layers must point to their source raster hashes and processing parameters.
- **Validate outputs:** run COG validation for Cloud-Optimized GeoTIFF outputs; check raster bounds and coverage against the AOI, NoData percentage, statistics, seam artifacts, and vertical plausibility. Never turn NoData into zero elevation.
- **Do not commit bulk county raster data by default.** Store source URLs and checksums in Git; store downloaded rasters in external storage, release assets, or an explicitly versioned data package with license and storage budget reviewed.

## Open GIS tooling to adopt

| Tool | Official capability reference | Recommended TSM use | Guardrails |
|---|---|---|---|
| **QGIS** | [Project](https://qgis.org/), [terrain analysis](https://docs.qgis.org/latest/en/docs/training_manual/rasters/terrain_analysis.html), [3D map view](https://docs.qgis.org/latest/en/docs/user_manual/map_views/3d_map_view.html) | Desktop QA of raster/vector layers, CRS inspection, terrain visualization, cartography, field editing, GeoPackage export and reproducible Processing models | Treat as analyst workstation tooling; commit project/model definitions and metadata, not unreviewed derived results. Pin a tested version for automated jobs. |
| **GRASS GIS** | [Manual](https://grass.osgeo.org/grass-stable/manuals/), [r.fill.dir](https://grass.osgeo.org/grass-stable/manuals/r.fill.dir.html), [r.carve](https://grass.osgeo.org/grass-stable/manuals/r.carve.html), [r.watershed](https://grass.osgeo.org/grass-stable/manuals/r.watershed.html) | Depression-aware terrain preparation, flow direction/accumulation, watershed/subwatershed and stream-network derivation; compare alternative conditioning methods | Hydro-conditioning can change flow paths. Store unconditioned source DEM and every conditioning parameter; validate against mapped hydrography and known culverts/drainage structures. |
| **GDAL** | [COG driver](https://gdal.org/en/stable/drivers/raster/cog.html), [COG validation](https://gdal.org/en/stable/programs/gdal_driver_cog_validate.html) | `gdalinfo`, clipping, reprojection, raster mosaics, raster statistics, format conversion, COG creation/validation and command-line pipelines | Pin GDAL version and explicit resampling/target grid; do not infer vertical-datum changes from `gdalwarp` alone. |
| **gvSIG Desktop** | [Product page](https://www.gvsig.com/en/products/gvsig-desktop) | Optional analyst alternative for vector/raster, database and remote-service interoperability | No TSM integration is required solely because it is an alternative; test formats and project reproducibility before standardizing. |
| **Overture Maps** | [Buildings](https://docs.overturemaps.org/guides/buildings/), [Transportation](https://docs.overturemaps.org/guides/transportation/) | Contextual building/road coverage, routing/network context, and candidate matching to authoritative state/local features | Community/conflated or ML-derived geometry is not survey-grade; preserve source/theme/release/feature IDs and license. Do not overwrite authoritative Indiana features. |

## Capability patterns from WTH Think GIS (requirements only)

Public references: [Think GIS overview](https://www.wthgis.com/think-gis-software), [About WTH](https://www.wthgis.com/about-wth), [2022 ThinkGIS.com brochure PDF](https://www.wthgis.com/images/Documents/Brochure_ThinkGIScom_2022.pdf), [Indiana Counties vendor listing](https://web.indianacounties.org/Associate/WTH-Technology,-Inc-149), and [utility tutorials](https://www.wthgis.com/resources/video-resources/think-gis-utility-tutorials).

The public materials describe these functional patterns, which can be implemented independently in TSM without reproducing proprietary assets:

- Responsive map UI across desktop/tablet/mobile, with controls sized for field use.
- Layer catalog, fast spatial search/query, attribute inspection, source/authority labels and user-defined visibility.
- Explicitly permissioned field edits with validation, audit history, offline queueing and conflict handling.
- Public-safety context overlays such as response boundaries, mutual-aid zones, critical facilities and traffic-control points, where lawful data sources exist.
- Utility asset layers and network tracing/isolation, with connectivity and topology validation; only enable this when a licensed/authoritative network dataset exists.
- Live situational-awareness overlays (AVL/CAD/event markers) behind server-side authorization, rate limits, retention policy, and explicit source health/provenance.
- Work orders and field task workflows with geometry, status, timestamps, assignee, attachments and an audit trail.
- Customer-managed roles and least-privilege permissions. This is a security requirement, not a UI-only feature.

The public [utility tutorial index](https://www.wthgis.com/resources/video-resources/think-gis-utility-tutorials) specifically demonstrates **Utility Trace Out** ([video](https://www.youtube.com/watch?v=XXP2azLx2W4)), **Adding a New Utility Line** ([video](https://www.youtube.com/watch?v=s1acqN4T580)), **Work Order Tool** ([video](https://www.youtube.com/watch?v=LsItGWcU0d4)), and **Flow Isolation Tool** ([video](https://www.youtube.com/watch?v=54p-oHkohOI)). These are requirements leads only: TSM would need validated network topology, authorized utility asset data, edit permissions, auditability and field-tested failure handling before implementing equivalents.

The public 2022 brochure also describes custom layers/aerials, automatic base-layer updates, field editing, live situational-awareness data, customer-managed user security, response boundaries, mutual-aid zones, critical facilities, traffic-control points, AVL/CAD/event markers, and 911 caller-location/confidence-circle overlays. For TSM, caller-location and CAD/AVL capabilities are high-sensitivity integrations: they must remain disabled until data agreements, access controls, retention rules, and authorized upstream connectors are present.

**Do not** scrape or redistribute authenticated Think GIS content, private customer maps, screenshots, proprietary data models, or code. Public feature descriptions can inform a clean-room requirements matrix; they do not establish that TSM has access to WTH's underlying datasets or integrations.

## TSM implementation matrix

| Priority | Capability / change | Existing project surface | Acceptance evidence |
|---|---|---|---|
| P0 | Download selected Posey DEM tiles to external cache with SHA-256 receipt | `data/posey-county/elevation/posey-dem-tile-manifest-2020.json`; new `scripts/posey/download-dem-tiles.ps1` | Selected filenames must exist in manifest; HTTPS host allowlist; byte/hash receipt; retry; no bulk download unless explicitly requested. |
| P0 | Preserve source CRS, vertical datum, units, vintage and NoData | Existing terrain provenance manifests and AOI readiness docs | Metadata inspection report plus fail-closed checks; no silent datum assumptions. |
| P0 | DEM processing reproducibility | Existing `scripts/geospatial/` tools | Versioned command/parameters, deterministic output hashes where feasible, synthetic tests and real-data QA report. |
| P1 | QGIS project and Processing model for analyst QA | `data/posey-county/`, `scripts/geospatial/` | Opens without absolute host paths; uses relative paths; labels screening versus regulatory layers; exports GeoPackage/COG with provenance. |
| P1 | GRASS watershed pipeline | Hydrology/terrain processing | Tests on synthetic DEM; compare conditioned/unconditioned drainage; validate outlets and known stream network. |
| P1 | GDAL COG QA gate | Tile/terrain build pipeline | `gdal driver cog validate` passes; dimensions, CRS, NoData and bounds match manifest. |
| P1 | Source authority and effective-date UI | `tsm-console/src/lib/map-layers.ts` and data fabric registries | Regulatory/observed/derived/context classes are visible; last-checked and product vintage are separate. |
| P2 | Clean-room public works / utility tracing | Map and graph services | Requires an actual authorized network dataset, topology rules, role controls and audit logs; no fake network data. |
| P2 | Field editing/work orders | New feature, not implied by source availability | Authenticated mutations, conflict resolution, offline sync, provenance, audit trail and retention policy. |

## Source links and verification notes

- IndianaMap DEM search: https://www.indianamap.org/search?tags=dem
- Indiana DEM tile footprints: https://www.indianamap.org/maps/ff98e3834d464619bd5c8974b0038a13
- Indiana Elevation Program: https://elevation.gio.in.gov/
- IGIC / Purdue countywide LiDAR: https://www.igic.org/countywide-lidar-and-dem-tiles
- USGS National Map Downloader: https://apps.nationalmap.gov/downloader/
- USGS 3DEP products: https://www.usgs.gov/3d-elevation-program/about-3dep-products-services
- FEMA NFHL: https://www.fema.gov/flood-maps/national-flood-hazard-layer
- USACE National Levee Database data services: https://levees.sec.usace.army.mil/data-services/services/
- QGIS terrain analysis and 3D: https://docs.qgis.org/latest/en/docs/training_manual/rasters/terrain_analysis.html and https://docs.qgis.org/latest/en/docs/user_manual/map_views/3d_map_view.html
- GRASS hydrology tools: https://grass.osgeo.org/grass-stable/manuals/r.watershed.html
- GDAL COG creation/validation: https://gdal.org/en/stable/drivers/raster/cog.html and https://gdal.org/en/stable/programs/gdal_driver_cog_validate.html
- Overture buildings/transportation: https://docs.overturemaps.org/guides/buildings/ and https://docs.overturemaps.org/guides/transportation/

This is a research-to-implementation plan. Source discovery, manifest presence, or a successful HTTP response does not by itself certify the downloaded pixels, coverage, datum, licensing, or engineering suitability.
