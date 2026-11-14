# AWS and source-registry adoption for TSM (2026-11-13)

TSM's release target is a free, native, network-disabled Windows 11 UE5.8 application, supported by a separate **optional** online *data-acquisition/build* pipeline. Never bring a serverless runtime, browser/WebView, live AWS mount, or cloud credential into Shipping builds. Any development tooling listed here still requires pinning a version and checking redistribution rights.

## Immediate adoption: public Indiana DEM source verification

- Canonical registry: [awslabs/open-data-registry: in-elevation.yaml](https://github.com/awslabs/open-data-registry/blob/main/datasets/in-elevation.yaml). Dataset is IGIO/IOT-managed, CC0, `s3://giselevationingov`, `us-east-2`. **Registry metadata is not a raster, spatial coverage, or scientific elevation proof.**
- **Distinct DEM asset location:** the committed IGIO `posey-dem-tile-manifest-2020.json` records 2.5-foot DEM `urlpath` objects under `gisimageryingov.s3.us-east-2.amazonaws.com/demoptimized/statewide/2020/SPW/2.5ft/`. This is **not** the `giselevationingov` bucket registered for the LiDAR/elevation archive. `verify_indiana_public_s3_dem.py` now probes the former with anonymous S3 HEAD; success must be established per object and checked against official layer URL paths. A registry bucket alone cannot authorize substituting a different object path or imply accepted NAVD88 Z.
- [Indiana 2016–2020 ImageServer](https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer) publishes **bare-earth, hydro-flattened** terrain (QL2). The service reports `F32`, single-band, display CRS `EPSG:3857` and pixel size `0.30480060960121846` m, while its description states **original** 2.5-ft pixel resolution for 89 counties and other original resolutions for three counties. Those published/service/original/export pixel grids are not interchangeable.
- [Official DEM tile polygon layer](https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0) publishes `filename`, `urlpath`, `county`, `image_year` and polygon geometry. **Do not assume** the catalog covers a source DEM simply because a grid-based filename can be calculated; use the separate `reconcile_posey_official_dem_tiles.py` polygon coverage report, preserving its original GeoJSON SHA-256 and any unlinked OBJECTIDs.
- The new `verify_indiana_public_s3_dem.py` refuses any official polygon report without **23,082** unique source buildings and zero uncovered building polygons; verifies S3 metadata with **anonymous** boto3; optionally downloads source tiles with SHA-256 and a non-overwriting atomic staging path. It always leaves source raster values, NAVD88/GEOID12B checks, roof heights and regulatory verification **false**.
- Avoid falsely treating S3 `ETag` as SHA-256. For original source bytes, use the full post-download digest. For testable DEM Z values, follow with **rasterio-based spatial/pixel and pinned vertical metadata tests** before building 3D meshes.

Example once an independently checked, complete `official-dem-tile-coverage.json` exists:

```bash
python -m pip install boto3
python scripts/geospatial/verify_indiana_public_s3_dem.py \
  --tile-polygon-report official-dem-tile-coverage.json \
  --receipt posey-public-dem-head-receipt.json

mkdir -p TSMData/terrain/indiana/posey/original
python scripts/geospatial/verify_indiana_public_s3_dem.py \
  --tile-polygon-report official-dem-tile-coverage.json \
  --download-dir TSMData/terrain/indiana/posey/original \
  --receipt posey-public-dem-download-receipt.json
```

The first command makes **HEAD-only** evidence; the second obtains source bytes but still needs pixel/datum QA. Preserve receipts outside immutable source data. Never synthesize the tile coverage report merely to permit a download.

## Reviewed AWS/core repositories

| Repository | Relevant TSM use | Adoption decision / limitation |
| --- | --- | --- |
| [awslabs/open-data-registry](https://github.com/awslabs/open-data-registry) | Trust anchor for the public Indiana source archive metadata | **Adopt** metadata links; independently verify objects |
| [awslabs/mountpoint-s3](https://github.com/awslabs/mountpoint-s3) | High-throughput Linux acquisition worker, streaming large raster source files | **Optional build-only**; limited POSIX semantics; S3 mount is online and Linux-only |
| [awslabs/aws-sdk-rust](https://github.com/awslabs/aws-sdk-rust) | Future native Rust *staging utility* with async S3 `GetObject`/head/list | **Evaluate** if Python unsigned boto3 cannot meet throughput; pin Rust MSRV, IAM/no-credentials design and benchmark |
| [awslabs/mcp](https://github.com/awslabs/mcp) | Agent-assisted inspection of AWS data inventory/IAM | **Development-only**; AWS recommends newer Agent Toolkit; do not make Windows runtime depend on an MCP server |
| [awslabs/llrt](https://github.com/awslabs/llrt) | Optional *serverless* metadata transforms in cloud ingestion | **Do not integrate into native runtime**; experimental, not a Node.js drop-in, disadvantage for large numerical tasks |
| [localstack/localstack](https://github.com/localstack/localstack) | Testing AWS service client interactions without incurring actual AWS calls | **Do not pin archived original** (archived Mar. 23, 2026); rely on Python fake-client tests until new offering/license is reviewed |

## Other queried repository candidates

| Repository | Possible fit | Disposition |
| --- | --- | --- |
| [awslabs/open-data-registry-browser](https://github.com/awslabs/open-data-registry-browser) | Data source-discovery interface | Optional research/UI reference; no webview in desktop release |
| [opensource-observer/oss-directory](https://github.com/opensource-observer/oss-directory) | External OSS source/licensing inventory | Candidate for evidence/provenance registry, not a geospatial solver |
| [opensource-observer/oss-funding](https://github.com/opensource-observer/oss-funding) | Funding data exploration | Research only; not authoritative grant-program eligibility |
| [DroneDB/Registry](https://github.com/DroneDB/Registry) | Open source geospatial asset storage/reference | Evaluate separately for ingestion service; do not add an extra server to offline Windows runtime |
| [ECCC-MSC/geomet-data-registry](https://github.com/ECCC-MSC/geomet-data-registry) | OGC weather-service registration architecture | Architectural reference only; Canadian datasets are outside the TSM region |
| [GSA-TTS/fed-data-mcp-registry](https://github.com/GSA-TTS/fed-data-mcp-registry) | Discovery of government data MCP endpoints | Development discovery only; each candidate must be checked against FEMA/USGS/NOAA agencies |
| [pluribus-one/gdpr-registry-app](https://github.com/pluribus-one/gdpr-registry-app) | Data-governance register ideas | Optional governance reference; not a GIS provider or required U.S. regulatory dependency |
| [dshworks/awesome-dsh-plugins](https://github.com/dshworks/awesome-dsh-plugins) | Community plugin listing | Not a trusted primary authority; any plugin needs security/license review |
| [dat-ecosystem-archive/datBase](https://github.com/dat-ecosystem-archive/datBase) | Historical peer-to-peer data sharing | Deprecated/archive; no adoption |

[ByteByteGoHq/system-design-101](https://github.com/ByteByteGoHq/system-design-101) and [bregman-arie/devops-exercises](https://github.com/bregman-arie/devops-exercises) are **educational** repositories, not runtime dependencies. [serverless/serverless](https://github.com/serverless/serverless) is not needed for an offline installer; [LibreChat-AI/LibreChat](https://github.com/danny-avila/LibreChat) is a different web application. These repositories do not close TSM's missing LiDAR heights or Win11 Shipping evidence.

## Evidence boundaries

No AWS library can recover an observed roof height from a **bare-earth DEM**. A per-building roof reconstruction must use validated classified point-cloud returns and footprint geometry, with vegetation-confounded results marked unavailable if not resolved. Likewise, no S3 file listing certifies a geoid model. The remaining 2,566 unavailable building heights, 22,836 missing DEM samples, and independent native offline launch remain open until actual source data, geodetic QA, and headed runtime receipts prove otherwise.
