# TSM audit: geospatial and engineering capabilities across public forks

Date: 2026-10-25. Target: ATphobia22/Tri-State-Systems-Manager ONLY.

## Scope and limitations

Searched GitHub repositories with user:ATphobia22 fork:true and paginated
ten 100-result windows (1,000 fork-search result records). This is a
**repository-name capability triage**, NOT a full source-code, security,
licensing or maintenance audit of all public/private forks. GitHub repository
search has a 1,000-result pagination ceiling; additional results and private
repos may be missing. No fork has been automatically vendored or installed.
No credential, token or private address is copied into the catalog.

## Priority 0: enhance current acceptance and scientific provenance

| Public fork | Capability to evaluate for TSM | Admission test |
|---|---|---|
| ATphobia22/usgs-lidar | 3DEP/LiDAR acquisition and data format utilities | authoritative USGS service, epoch, source metadata and checksums |
| ATphobia22/3d-tiles-tools | tile traversal, content validation, glTF/3D Tiles conversion | run OGC 3D Tiles 1.1 and glTF conformance; preserve source OBJECTIDs |
| ATphobia22/Open3D | point-cloud and mesh geometry quality assurance | deterministic tests against verified LAS/LAZ and geometry fixture |
| ATphobia22/geojson-vt | tile-based screening overlays | preserve exact source polygon topology and source ID |
| ATphobia22/mercantile | consistent XYZ map tile indexing | offline checksum-backed raster and vector tiles |
| ATphobia22/maplibre-cog-protocol | local COG raster support for web preview | no cloud dependency in native runtime |
| ATphobia22/openfema-api-python-client | FEMA flood data ingestion candidates | preserve effective panel/date and agency authority |
| ATphobia22/geospatial-data-catalogs | source discovery / coverage manifests | verify actual jurisdiction, vintage, license, CRS |
| ATphobia22/overture-tiles | supplemental building/map baselayers | NEVER overwrite authoritative IGIO OBJECTID lineage |

## Priority 1: engineering and simulation interfaces

| Public fork | Candidate contribution | Mandatory boundary |
|---|---|---|
| ATphobia22/hms-commander | HEC-HMS orchestration | solver/version/parameter/input checksums |
| ATphobia22/hydromt | reproducible hydrologic modeling and basin preparation | calibrated AOIs and model authority stay human-reviewed |
| ATphobia22/usace-flood-geoprocessing | hydraulic/flood geoprocessing patterns | cite and validate against USACE primary standards |
| ATphobia22/pyswmm | stormwater scenario adapter | report separate scenario uncertainty |
| ATphobia22/modflow6 | groundwater solver integration | explicit georeferencing, convergence and calibration |
| ATphobia22/OpenFOAM-dev | CFD mesh/solver experiments | computational reproducibility; never substitute for HEC evidence |
| ATphobia22/geoglows-rest-api | additional streamflow predictions | label model forecasts; never relabel as USGS observations |
| ATphobia22/water-use | agricultural demand / groundwater context | source vintage and use restrictions |
| ATphobia22/modflow-setup | groundwater model input tooling | compare coordinate systems and grid unit conversions |

## Priority 2: visualization and asset authoring

| Public fork | Candidate contribution | Separation of roles |
|---|---|---|
| ATphobia22/HoudiniEngineForUnreal | procedural infrastructure/terrain authoring | must validate UE5.8 binary/plugin compatibility |
| ATphobia22/HoudiniUsdBridge | USD roundtrip and scene metadata | preserve structural IDs and NAVD88 values |
| ATphobia22/3dfier | derivation of simple urban meshes | informational LOD only; not survey geometry |
| ATphobia22/3DTilesRendererJS | web preview, OGC tile comparisons | native Windows remains Cesium for Unreal |
| ATphobia22/3dcitydb-web-map | building asset catalog and city models | source ID provenance and permission checks |
| ATphobia22/maplibre-gl-usgs-lidar | raster/point cloud web-preview layers | no external HTTP dependency at offline startup |
| ATphobia22/mbtileserver-rs | optional local MBTiles tile service | prefer in-process/file-based offline runtime |
| ATphobia22/3d-tiles | OGC 3D Tiles reference implementation patterns | pin versions and run validators |
| ATphobia22/Blender_GES_Import | procedural/cinematic asset pipeline candidate | prohibit fabricated engineering details |

## Explicit admission gate for all fork code/data

1. Inspect upstream parent, license/SPDX and dependency transitive licenses;
   neither fork visibility nor repository presence grants a legal license.
2. Inspect last maintenance activity, release tags and matching engine/API
   versions (especially Unreal Engine 5.8 / Cesium for Unreal).
3. Pin commit hashes or package versions; prefer audited upstream releases
   over a personal fork lacking a security-maintenance plan.
4. Build an adapter + regression test, never directly copy the entire fork
   into TSM. Scan for secrets, vulnerable dependencies and restricted data.
5. Reuse original governmental data authorities: IGIO, USGS, FEMA, NGS,
   NOAA/NWS, NRCS/USDA, USACE. A fork is software, not data authority.
6. For every raster/point cloud: record units, datum/realization, epoch,
   vertical uncertainty, footprint/source identity and SHA-256.
7. Keep unauthenticated read-only public access, offline Windows packaged
   assets and final human review for engineering/regulatory conclusions.

## Current implementation decision

World Partition prefetch support and an Unreal Editor map-generation script
are added as first-party TSM source files instead of importing an unverified
game-engine fork. Cesium continues streaming OGC 3D Tiles. The full 23,082
IGIO footprint/height acceptance remains a distinct gate and cannot be
marked complete by World Partition, new rendering, or additional sources.

For the remaining public forks beyond GitHub's search-result ceiling, use
more selective name/topic/creation-time queries and reconcile against an
exported repository inventory before making exhaustive-coverage claims.


## Extended date-partitioned fork search (2026 inventory)

Follow-up queries split creation dates by month and week to look beyond
GitHub's 1,000-result search window. This surfaced additional candidates,
without assuming they are maintained, licensed for redistribution or
production-compatible:

| Fork | Possible use | Required verification |
| --- | --- | --- |
| ATphobia22/UEGeoCoordinates | Unreal native local/geographic transformations | UE5.8 C++ ABI, EPSG:2966 US-survey-foot and NAVD88 support, unit tests |
| ATphobia22/BlenderGIS | Blender-based DEM / OSM authoring | original geometry license, coordinate transforms and source hashes |
| ATphobia22/osm2pgsql | OSM street/asset ingest into PostGIS | version and ODbL attribution / database rights |
| ATphobia22/nfie-floodmap | supplemental flood visualization technique | distinguish model output from effective FEMA maps |
| ATphobia22/gdal | geospatial reprojection and clipping libraries | prefer official maintained GDAL binaries and PROJ grids |
| ATphobia22/earthaccess | authenticated NASA Earthdata/STAC retrieval | offline asset caching and data-vintage receipts |
| ATphobia22/HEC-Commander | HEC workflows and orchestration | solver version, QA reports and model input checksum |
| ATphobia22/awesome-satellite-imagery-datasets | discovery of alternate coverage | validate each original agency and temporal resolution |
| ATphobia22/QGIS | desktop validation workflows | no dependency on GUI inside native packaged runtime |
| ATphobia22/segment-geospatial | geospatial segmentation for nonauthoritative LOD planning | false-positive review; never synthesize building source IDs |

Several weekly windows still returned the 100-result page limit; a fully
exhaustive fork inventory requires finer day-partition searches and an
authenticated export. These are **candidate workflows**, not completed
integrations. The existing TSM scientific and legal acceptance rules prevail.
