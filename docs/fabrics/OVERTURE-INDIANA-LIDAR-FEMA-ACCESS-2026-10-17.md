# Source-access and acquisition notes: Overture, Indiana elevation, FEMA NFHL, and NOAA LiDAR

**Reviewed:** 2026-10-17  
**Primary AOI policy:** community-scale Lower Wabash / Ohio River confluence. A linked catalogue is not proof that the dataset overlaps the AOI or is acquired.  
**Engineering status:** source discovery/ingestion only; no flood-model execution or approval is implied.

## What is usable now?

| Source | Verified access route | TSM state | Correct role |
| --- | --- | --- | --- |
| Overture Maps Python client | [Official CLI docs](https://docs.overturemaps.org/getting-data/overturemaps-py/) and [Python client repo](https://github.com/OvertureMaps/overturemaps-py) | Existing bounded Posey extracts and shard manifests are already in the data/overture folder; global shards are not mirrored | Open community vector buildings context; derived/non-surveyed geometry |
| Indiana 2016–2020 QL2 LiDAR/DEM | [ISDP collection page](https://gis.iu.edu/s/isdp/page/20162020elevation), [Purdue/iDiF download viewer](https://lidar.digitalforestry.org/), [IGIC catalogue](https://www.igic.org/countywide-lidar-and-dem-tiles) | Partially present. The current manifest references 581 tiles; a Posey 2.5-ft tile and small derivatives are committed, not the statewide collection | Terrain/point-cloud evidence; still requires per-product metadata and datum checks |
| FEMA NFHL | [Canonical public ArcGIS REST MapServer](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson) | Live REST layer registry is documented; no claim that every feature or full NFHL package is committed | Effective regulatory flood-hazard reference, with source/effective-date preserved |
| FEMA portal routes | [NFHL WMS/viewer page](https://hazards.fema.gov/femaportal/wps/portal/NFHLWMS) and [search UI](https://hazards.fema.gov/femaportal/NFHL/searchResult/) | Browser/viewer routes only; Firecrawl could not load these pages on this review | Human discovery and visualization; not the canonical ingestion API |
| NOAA OCM / Indiana DNR 2024 Coastline LiDAR, OpenTopography ID 10356 | [NOAA direct S3 product index](https://noaa-nos-coastal-lidar-pds.s3.amazonaws.com/laz/geoid18/10356/index.html), [OpenTopography record](https://portal.opentopography.org/noaaDataset?noaaID=10356) | Metadata/index verified; full 24 GB set is **not downloaded** and does not overlap the primary Lower Wabash/Ohio pilot AOI | Optional regional LiDAR source only if a verified future AOI intersects its coverage |

## Overture Maps — install only on the acquisition host

The official Python client streams bounded downloads and supports GeoJSON, GeoJSON sequence, and GeoParquet. It can read the latest STAC release automatically. Install it only in the geospatial acquisition environment; it is not a web-console runtime dependency.

    python -m pip install overturemaps

    # Set these to the west,south,east,north bounds of an approved AOI.
    # Do not omit --bbox: omission means the entire selected feature type.
    export WEST=-88.2 SOUTH=37.6 EAST=-87.5 NORTH=38.2
    export AOI_ID=approved-aoi-id
    mkdir -p data/overture/derived
    overturemaps download --bbox="$WEST,$SOUTH,$EAST,$NORTH" --type=building -f geoparquet -o "data/overture/derived/$AOI_ID-buildings.geoparquet"
    overturemaps download --bbox="$WEST,$SOUTH,$EAST,$NORTH" --type=building_part -f geoparquet -o "data/overture/derived/$AOI_ID-building-parts.geoparquet"

Before promoting an extract, record the actual CLI version, release/catalog identity, exact bbox, retrieval timestamp, command, SHA-256, and license. Overture's release catalog can change: do not treat a command that tracks the latest release as a reproducible fixed-version acquisition. Current repository extracts are tied to the release recorded in data/overture/README.md and its shard manifests.

The buildings theme is recorded in the repository as ODbL-1.0. Preserve attribution and share-alike obligations where applicable. Overture footprints and parts are **not surveyed boundaries**, and any height attributes are estimates/source properties—not certified building heights. Never classify this source as FEMA/USGS/Indiana government authority.

## Indiana 2016–2020 elevation program — use product-level metadata

The ISDP describes a statewide QL2 3DEP collection acquired in 2016–2018, with additional counties acquired in 2019 and 2020. Deliverables include classified LAS, 2.5-ft bare-earth hydro-flattened DEMs (largely ERDAS IMAGINE .img), county DEM mosaics, intensity products, limited DSM products, and hydro-breaklines. Posey, Vanderburgh, and Warrick are listed among the 2020 acquisition counties.

Useful catalog and metadata links:

- [ISDP 2016–2020 statewide collection](https://gis.iu.edu/s/isdp/page/20162020elevation)
- [County DEM mosaic item set](https://gis.iu.edu/s/isdp/item-set/71301)
- [Purdue/iDiF interactive download viewer](https://lidar.digitalforestry.org/)
- [Official collection metadata ZIP](https://lidar.digitalforestry.org/outbox/Indiana_2016_2020_LiDAR_Metadata.zip)
- [Accuracy and data-access review](https://lidar.digitalforestry.org/docs/Indiana_3DEP_Lidar_Data_Products_Data_Accuracy_and_Data_Access.pdf)
- [IGIC statewide LiDAR/DEM catalogue](https://www.igic.org/countywide-lidar-and-dem-tiles)

Horizontal coordinate reference depends on county and product: the ISDP identifies EPSG:2965 (Indiana State Plane East) and EPSG:2966 (Indiana State Plane West), in US survey feet. Neither horizontal EPSG code establishes the vertical datum. Retain the vertical datum from the actual product metadata and inspect LAS/GeoTIFF headers before mosaicking or using elevations as model inputs. The Purdue page says these 3DEP products are free/CC0, while also warning that some official metadata and vertical-accuracy analysis may lag; preserve that caveat.

Current repository acquisition manifest: data-sources/manifests/indiana-dem-2020.json. Use the existing index/manifests and run the Indiana elevation tool with --help to see the supported bounded tile-fetch operations. Do not mirror every statewide tile into Git simply because the index is available.

## FEMA NFHL — discovery UI is not the ingestion API

Canonical machine-readable service:

    curl --fail --silent --show-error 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson' -o /tmp/tsm-fema-nfhl-mapserver.json

Use service metadata to enumerate layer IDs/fields, then query only the required layers with an explicit AOI envelope/polygon, input spatial reference, spatial relation, requested fields, output CRS, and pagination as required. Save the returned service layer ID, retrieval time, source URL, effective/regulatory status, original attributes, geometry CRS, and checksum with every persisted response. Prefer small metadata snapshots for discovery; do not run unbounded where=1=1 geometry downloads across the whole NFHL as a generic initialization step.

The two supplied Femaportal routes are viewer/search pages. They were not fetchable by Firecrawl on this review; that is a scraper/browser-route limitation, not proof that FEMA NFHL itself is down. TSM's source registry points to the public NFHL REST MapServer instead. FEMA effective mapping and Indiana DNR best-available flood mapping must remain separate authority classes.

## NOAA/OpenTopography 2024 Indiana Coastline (dataset 10356)

The record says this collection covers Cook County, Illinois; Lake, LaPorte, and Porter Counties, Indiana; and Berrien County, Michigan. The NOAA-hosted index reports 2,139 LAZ tiles and approximately 24 GB total, with acquisition dates 2024-04-15 through 2024-04-19. This is **northwest Indiana / northeast Illinois / southwest Michigan coverage**, not the current Posey / lower Wabash / Ohio River pilot AOI. Do not download all of it for the current workstream.

The OpenTopography record reports access restrictions for its web workflow (eligible US academic users with .edu addresses, certain educators by application, or OpenTopography+ members). The direct NOAA S3 index separately publishes metadata, tile indices, a tile URL list, and file links. If a future approved AOI intersects this product footprint, acquire the tile index and metadata first, spatially select intersecting tiles, then fetch only those objects and record each file hash.

The NOAA S3 spatial-reference section identifies NAD83(HARN) / UTM Zone 16N horizontally and NAVD88 using GEOID18 in metres vertically. The OpenTopography overview also reproduces an original-product abstract with a different horizontal CRS description. That discrepancy must be resolved from the downloaded tile headers and source metadata before any combination or engineering use; do not infer that reprojection alone converts a vertical datum.

## Acceptance gates for all acquisitions

1. **AOI:** approved geometry, extent, buffer, and a demonstrable intersection with the source coverage.
2. **Acquisition:** source URL, timestamp, HTTP status, release/vintage, product identifier, license/terms, command, byte count, and SHA-256.
3. **Geometry:** schema/feature counts or raster/point-cloud dimensions; invalid geometries/nodata checked; actual CRS and vertical datum read from metadata.
4. **Lineage:** raw download retained separately from curated derivatives; every transformation records software/version and inputs.
5. **Promotion:** no source becomes an approved HEC-RAS input, survey, building certification, or regulatory determination by appearing on a map. Engineering use stays blocked until the project's upstream QA/QC and human-review gates pass.

## Toolchain boundary

- Console/runtime: no extra Overture dependency is required.
- Overture acquisition workstation: install the official overturemaps Python package as shown above.
- Indiana elevation: use existing repository catalog/manifests and official product metadata; no new statewide mirror is justified.
- FEMA: use the public REST service metadata/layer-query route, not scraped portal HTML.
- NOAA coastline: keep registered as an optional external regional source until an approved AOI intersects it; no 24 GB full-catalog download is needed for the present AOI.
