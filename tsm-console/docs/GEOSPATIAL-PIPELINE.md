# TSM High-Resolution Geospatial Pipeline

## Scope

This integration establishes a reproducible contract for Posey County / Point Township LiDAR processing without committing large raw point-cloud binaries to Git.

The repository records source URIs, processing configuration, provenance metadata, and CI validation. Raw LAS and generated DEM artifacts are materialized outside Git by the ingestion utility.

## Registered inputs

- Dataset registry: `config/lidar_registry.json`
- Toolchain contract: `config/geospatial_toolchain.json`
- LiDAR fetch utility: `scripts/download_bonebank_lidar.sh`
- PDAL processing pipeline: `pipelines/pdal/bone_earth_crop.json`
- TypeScript process bridge: `src/integrations/repository_bridge.ts`

## Processing contract

1. Read the four registered LAS tiles using the existing Indiana West CRS contract (`EPSG:2966`).
2. Merge point clouds.
3. Retain ASPRS Class 2 ground points.
4. Reproject horizontal coordinates to `EPSG:6345`.
5. Crop to a 15.24 m (50 ft) radius around the supplied structural centroid.
6. Write a cropped ground LAS artifact.
7. Rasterize the minimum ground elevation to a GeoTIFF at 0.1524 m (0.5 ft) cell size.

EPSG:6345 is metric; therefore the 0.5 ft output resolution is represented as 0.1524 m in the PDAL writer. EPSG:6345 is **not** a US-survey-foot CRS. See the EPSG definition at https://epsg.io/6345.

## Engineering-value boundary

The registry preserves the supplied BFE and LAG values for traceability, but CI does not certify them. In particular, the minimum elevation of a 50 ft raster crop is not, by itself, a certified Lowest Adjacent Grade. A defensible LAG determination requires the appropriate structure/grade survey definition and source evidence.

## CI

The repository's main parse gate now executes:

`lockfile provenance → reproducibility → npm ci → integrity → geospatial contract → parse → TypeScript → production Vite build → tests`

The geospatial contract gate validates the registry, required PDAL stages, CRS, crop radius, provenance policy, and raw-data exclusion without requiring a 305 MB LAS file to be stored in the repository.

## Runtime processing

Materialize the registered tiles locally with:

```bash
bash scripts/download_bonebank_lidar.sh
```

Then run:

```bash
pdal pipeline pipelines/pdal/bone_earth_crop.json
```

The TypeScript bridge uses `spawnSync` argument arrays rather than shell interpolation, preventing pipeline paths and artifact paths from becoming shell command strings.

## Agency-review posture

This repository layer is an engineering/data-processing implementation. CI validation establishes reproducibility and structural correctness; it does not constitute a survey, floodplain determination, regulatory certification, or professional engineering certification.
