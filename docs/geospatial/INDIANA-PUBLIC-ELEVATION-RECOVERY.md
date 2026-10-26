# Indiana open elevation archive — exact-grid discovery and safe recovery

Authoritative public catalog: https://registry.opendata.aws/in-elevation/

**Bucket:** `s3://giselevationingov`, **Region:** `us-east-2`,
**license:** CC0. Public read access does **not** require using or configuring
TSM's own AWS account or creating AWS resources.

The 2026-10-26 production LiDAR run #40262995508 processed 446 Indiana 2020
QL2 COPC tiles before the strict building-height gate failed:
11,821 OBSERVED, 8,696 DERIVED, 2,565 UNAVAILABLE. The grid-name index committed
here was independently reconstructed from the **446 unique processed tile
names in the GitHub run logs**, not from invented public source feature IDs.

AWS S3 ListObjectsV2 verified exact matching keys for **446/446 of these grids**
in each of the following alternatives. The object names were actually
present in `giselevationingov` on 2026-10-26:

| Alternate product | Confirmed S3 key template | Scope |
| --- | --- | --- |
| 2020 normalized digital height model (NDHM) | `ndhmoptimized/statewide/2020/SPW/5ft/IN2020_{GRID}_12_ndhm.tif` | 446/446 |
| 2013 QL3 COPC | `copc/statewide/2013/SPW/ql3/in2013_{GRID}_12.copc.laz` | 446/446 |

A separate sampled grid `27751070` was also positively verified by
AWS HeadObject for 2020 DSM, DEM, original LAS, and 2013 NDHM:

```text
dsmoptimized/statewide/2020/SPW/5ft/IN2020_27751070_12_dsm.tif
demoptimized/statewide/2020/SPW/2.5ft/IN2020_27751070_12.tif
las/statewide/2020/SPW/ql2/IN2020_27751070_12.las
ndhmoptimized/statewide/2013/SPW/5ft/in2013_27751070_12_ndhm.tif
```

The S3 **ETag is not a SHA-256 content checksum**. Do not invent whole-file
hashes from remote HEAD responses; download each selected tile using a
bounded, atomic process and SHA-256 hash its bytes before spatial analysis.

## Recovery priority

1. Preserve the original source ID, accepted-height status and inability reason
   for every one of the 2,565 missing roofs using the newly merged
   `emit_building_height_gap_evidence.py`. Do not repeat all 446 COPC jobs
   without evidence that the extraction method will recover missing points.
2. Plan candidate 2020 NDHM, DSM and DEM files for *affected* grids; match exact
   IGIO source IDs, not nearest addresses, parcel centroids or NSI record IDs.
3. Validate each GeoTIFF's native CRS, pixel-unit convention, NoData,
   version/time, source metadata, interpolation, vegetation confounds,
   rooftop footprint-interior coverage, uncertainty and footprint topology.
   The "5ft" key denotes the **horizontal raster pixel size**, not proof that
   its height values are expressed in feet.
4. Classify valid raster samples as **CANDIDATE_NDHM_REVIEW**; they may only be
   promoted to accepted DERIVED heights if independent scientific QA and
   method-specific evidence requirements are satisfied. Never fake LiDAR
   point-return counts using raster pixel counts.
5. 2013 QL3 point clouds and NDHM are *historical cross-checks only*. A 2013
   structure or roof may not match the 2020 building footprint. No automated
   cross-year height adoption without structure/date concordance.
6. The 2025-2028 IGIO QL1 program must not be treated as delivered Posey
   data until exact official tiles and acquisition metadata are verified.
7. Once approved data has yielded heights, rerun the strict 23,082 source
   and ground/roof audit, LOD1/LOD2 reconstruction, OGC 3D Tiles 1.1 validator,
   spatial coherence, feature linkage, and SHA-256 artifact verification.

## Bounded inventory command

```sh
python3 scripts/geospatial/verify_in_elevation_recovery_sources.py \
  --tile-list data/posey-county/elevation/posey-2020-copc-grid-run-40262995508.txt \
  --layers 2020_NDHM 2013_COPC \
  --verify --workers 8 --timeout 15 \
  --out /private/igio-alternate-source-availability.json
```

This issues HEAD requests against only the official public Indiana S3 bucket.
It does **not** download LAS, COPC, DEM, DSM or NDHM; it does not validate a
single building height. Omit `--verify` to generate an offline key plan.

USACE modeled NSI height/ground attributes remain secondary QA and are
never substituted for authentic LiDAR. The official 2016-2020 DEM image
service also provides a potential ground-elevation cross-check:
https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer

Issue #416 remains open for the real countywide 3D Tiles acceptance.
