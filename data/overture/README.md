# Overture Maps buildings — Posey AOI extract

**Release:** 2026-09-23.1  
**Theme:** buildings / type=building  
**Downloaded:** 2026-10-17

## What was downloaded

Full global Overture buildings is **~2.53 billion features across 512 GeoParquet shards** (~hundreds of GB). That is not practical to mirror in-repo.

Instead:

1. STAC scanned all 512 building items for intersection with Posey approx bbox  
   `[-88.25, 37.75, -87.75, 38.20]`
2. **Two** shards cover that AOI (part-00043, part-00050; ~1.25 GB total).
3. Both shards were downloaded from S3, then DuckDB filtered to the bbox.
4. Deliverable: `posey-buildings-extract.parquet`

| Metric | Value |
|--------|--------|
| Buildings in Posey bbox extract | **24,375** |
| With `height > 0` | **18,302** |
| Median height (m) | **3.666** |
| Mean height (m) | **3.88** |

## Paths

- S3 release: `s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/`
- License: ODbL-1.0 (buildings theme)
- Schema: height in meters (optional); sources may include OSM, Microsoft, Google Open Buildings

## Not included

- Full 512 global shards (terabyte-class)
- building_part theme
