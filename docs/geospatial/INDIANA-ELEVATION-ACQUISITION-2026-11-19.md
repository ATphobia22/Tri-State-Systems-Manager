# Indiana elevation acquisition — 2026-11-19

Status: **SOURCE_PACK_UPLOADED; SOURCE_RASTERS_NOT_NEWLY_DOWNLOADED; ENGINEERING_ACCEPTANCE_PENDING**.

## Immutable source pack
- Google Drive: https://drive.google.com/file/d/1wKyAwAHq_NuCZxwEgWnYNFFJn56aeUKu/view?usp=drivesdk
- Drive parent: TSM-Posey-DEM (1pPguzTVVQvw55IICz9rMcN5wSAUYaKWf)
- Archive SHA-256 (local): `1bbbbd59876ea84d40842d8afe7d2f2affe9b69e17499f137a826f4ef04f5969`
- Contents: source CSV, README, bounded download shell script. **Not** a raster-data bundle.

## Official acquisition authority
- IGIO catalog: https://registry.opendata.aws/in-elevation/
- IGIO DEM footprints: https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0
- IU acquisition details: https://gis.iu.edu/s/isdp/page/20162020elevation
- 2020 Posey QL2 LiDAR, EPSG:2966 horizontal reference; vertical datum and pixel units must be verified per artifact.
- Public archive: `s3://giselevationingov` (us-east-2, anonymous read).
- 2020 DEM prefix: `demoptimized/statewide/2020/SPW/2.5ft/`
- 2020 DSM prefix: `dsmoptimized/statewide/2020/SPW/5ft/`
- 2020 nDHM prefix: `ndhmoptimized/statewide/2020/SPW/5ft/`

## Existing Drive assets to reconcile
- `IN2020_26700930_12.tif`, Drive file 1Y2LVtr2uVP0EjmaMziOyUe0n6PLp5gdj, 15170693 bytes
- `IN2020_26850945_12.tiff`, Drive file 1op0lCq_09E7x79d52ScTGXl1Fb-wcYmr, 21064965 bytes
- `IN2020_26700930_12.tiff`, Drive file 1QTV2kulVc7D61L-kjZ7qkcvf68SzD8CB, 15170693 bytes
- Sizes are not hashes. Duplicate identity unverified.

## Required acceptance gates
1. Download exact selected official raster keys, with bounded atomic transfers and content SHA-256.
2. Verify raster integrity, native CRS WKT, pixel units, nodata, resolution, bounds, acquisition date, vertical datum and geoid metadata.
3. Intersect coverage with exact county geometry, not a bounding box alone; preserve gaps.
4. Validate 2020 DEM/DSM/nDHM values against classified LiDAR and surveyed controls before any engineering use.
5. Reconcile 23,082 source building identities, 2,565 height gaps, 29 DEM gaps and 267 missing published IDs independently.
6. Run raster-to-terrain and building-3D-tiles tests; record evidence and CI before merging.
7. Validate packaged offline Windows UE5.8 Shipping separately; ordinary CI is not Shipping proof.

No new source pixels were downloaded or engineering-validated in this work session. Do not mark any elevation tile as engineering-ready from archive availability or filename alone.
