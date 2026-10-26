# Indiana Elevation Registry — source recovery for Posey County buildings

**Official discovery:** https://registry.opendata.aws/in-elevation/ .
Owner/steward: Indiana Geographic Information Office (IGIO) and State of
Indiana; license: **CC0**. Public S3 bucket: `giselevationingov`.
S3 region: **us-east-2** (Ohio). No AWS account is required to read the
public dataset. Registry citation: "Indiana Statewide Elevation Catalog,
accessed 2026-10-26, https://registry.opendata.aws/in-elevation/".

TSM authenticated AWS Core independently queried **ListObjectsV2** and
**HeadObject** for these real S3 paths on 2026-10-26:

| Purpose | Source | Prefix |
|---|---|---|
| Alternative height raster candidate | IGIO 2020 5-foot nDHM | `ndhmoptimized/statewide/2020/SPW/5ft/` |
| Surface QA and roof candidate localization | IGIO 2020 5-foot DSM | `dsmoptimized/statewide/2020/SPW/5ft/` |
| Terrain gaps (29 in prior run) | IGIO 2020 2.5-foot bare-earth DEM | `demoptimized/statewide/2020/SPW/2.5ft/` |
| LiDAR source cross-check | IGIO 2020 classified LAS | `las/statewide/2020/SPW/ql2/` |
| Existing TSM LiDAR-derived processing | IGIO 2020 COPC | `copc/statewide/2020/SPW/ql2/` |
| Older acquisition alternatives, separate vintage | IGIO 2013 QL3 COPC | `copc/statewide/2013/SPW/ql3/` |
| Older normalized height QA, separate vintage | IGIO 2013 nDHM | `ndhmoptimized/statewide/2013/SPW/5ft/` |

Exact 2020 filename forms:

- `IN2020_26850945_12.copc.laz`
- `IN2020_26850945_12_ndhm.tif`
- `IN2020_26850945_12_dsm.tif`
- `IN2020_26850945_12.tif`
- `IN2020_26850945_12.las`

The 2013 filename uses lowercase `in2013_...`, and its point-cloud
specification uses a *different quality level and date*. Do not imply
every 2013 tile exists merely because its grid index corresponds to a
2020 tile. **2025 DSM objects also exist in the archive, but are not
assumed to cover Posey County or to provide measured height acceptance.**

## Provenance/acceptance boundary

The 2026-10-26 production run generated 11,821 OBSERVED and 8,696 DERIVED
height records, but **2,565 lacked accepted height evidence**. It also
reported 29 DEM sample gaps, 267 previously unpublished mesh IDs, and an
unverified uploaded candidate with 12 self-intersecting polygons.

The nDHM and DSM are potential **new LiDAR-derived evidence sources** for
those gaps. A raster pixel is not intrinsically a building roof: tree
canopy, mixed pixels, nodata, inconsistent vertical units, 2013/2020
mismatch, projection, and footprint clipping all require validation.
No new source may change `lidarHeightStatus` to `OK` or
`heightProvenance` to `DERIVED` on *availability alone*.

Inspect raster EPSG/units/scales and a source-matched normalized-height
sample against existing true LiDAR observations *before* implementing
height recovery. Perform robust within-polygon pixel filtering,
vegetation/roof dispersion QA, and per-OBJECTID provenance. A valid
nDHM value is **not** an accredited NAVD88 ground elevation. S3 ETag is
not SHA-256; especially for multipart COPC/LAS files.

## Reproducible bounded archive probe

After generating the COPC tile list, run:

    python3 scripts/geospatial/verify_in_elevation_recovery_sources.py \
      --tile-list /tmp/tsm-igio/copc-tile-list.txt \
      --layers 2020_NDHM 2020_DSM 2020_DEM 2013_NDHM \
      --verify --workers 12 \
      --out /tmp/tsm-igio/indiana-elevation-source-inventory.json

This outputs a coordinate-free, SHA-pinned source-inventory file plus
`.sha256` sidecar. It uses public unsigned **HEAD** requests only and
never downloads raster pixels, LiDAR records or source geometry.
`PRESENT` means a public object exists, **not** that its datum,
classification, building height or roof identity was verified.
Use `--verify` for the remote metadata probe; without it the script
generates a deterministic, explicitly `NOT_PROBED` offline plan.

Continue following the existing strict 23,082-source OGC 3D Tiles 1.1
acceptance criteria and keep the public visual preview informational.
Related: https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416 .

## Live GeoTIFF metadata inspection

The dedicated GitHub Actions `sample-raster-metadata` job downloads **one**
known public 2020 nDHM COG, capped at 12 MiB, to inspect its embedded CRS,
horizontal pixel resolution, band-unit metadata, datatype, nodata flag, and
masked subsample statistics. Only the SHA-256-pinned *metadata receipt* is
retained; the raster is **not** uploaded. This non-acceptance QA remains
separate from source inventory and does not establish a measured roof height.
If unit metadata is missing, mark height units **UNVERIFIED** rather than
assuming U.S. survey feet from the horizontal CRS.

## Empirical nDHM quality flag from public COG (2026-10-26)

The GitHub runner downloaded the official
`IN2020_26850945_12_ndhm.tif` sample (3,032,895 bytes; SHA-256
`fd8900e92d43005064197b58d3b4567c21c747aed0030fb1be66cc419fd1a6cd`).
Rasterio reported `float32`, **5.0 × 5.0** native pixel spacing, and
**US survey foot** band units. It did **not** resolve an EPSG authority
(`to_epsg() is None`) and found **no explicit nodata sentinel**.
Its 256×256 masked sample ranged from **−6.56437 to 116.65925** ft.
Negative normalized-height pixels and the unresolved CRS prove that
sampling cannot safely be admitted as positive, georeferenced roof
heights without additional metadata/CRS and error screening.
The workflow now records original CRS WKT and negative-pixel counts to
enable this investigation. No sampled pixel is automatically accepted.
