# Overture bounded buildings ingestion

**Status:** reproducible extraction contract; output is not present or validated until the extraction is run in an environment with DuckDB, its Spatial and httpfs extensions, and network access to the public Overture S3 release.

## Immutable source

- Release: `2026-10-21.0`
- Dataset: `theme=buildings/type=building`
- Source prefix: `s3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings/type=building/*`
- AOI bounding box, EPSG:4326: west `-88.5`, south `37.5`, east `-87.0`, north `38.5`
- Output: `data/buildings/overture_buildings_2026-10-21.0.geojson`
- License and attribution must be retained from the applicable Overture release documentation and source records.

Run from the repository root:

```bash
duckdb < scripts/geospatial/overture_buildings_2026-10-21.0.sql
```

The query uses **bounding-box intersection**:

```sql
bbox.xmax >= west AND bbox.xmin <= east
AND bbox.ymax >= south AND bbox.ymin <= north
```

Do not replace these predicates with containment predicates. Intersection preserves candidates whose bounding boxes cross the AOI boundary. This is a candidate extraction, not a claim that geometries have been clipped to the AOI polygon.

## Release gate

Before publishing, record the release ID, retrieval UTC, SQL SHA-256, output SHA-256, feature count, unique-ID count, geometry-type counts, invalid/empty geometry count, and attribute completeness for `height`, `roof_shape`, and `roof_height`.

Compare to the legacy footprint dataset only after identifying its exact path, release, AOI, license, and manifest. The repository's recorded Posey extract for release `2026-09-23.1` reports 24,375 `building` features and is a different baseline from the separately cited 22,815-footprint legacy layer; do not silently treat these counts as the same dataset or use either as an expected count for the larger eight-county bounding box.

Required differential outputs:
- net-new IDs and removed IDs (ID set difference, with source/release recorded);
- attribute population rates and null distributions;
- geometry validity and geometry type changes;
- features whose geometry intersects the AOI boundary, plus features extending outside the AOI;
- duplicate IDs and candidate matches where IDs changed between releases.

A bounding-box candidate may cross the AOI edge by design. Boundary contact is not itself a clipping defect. Flag actual geometry truncation only when comparison to source geometry or an authoritative clipping operation proves it.

## Safety and provenance

- Keep Overture structures explicitly classified as derived mapping data, not survey-grade footprints or regulatory evidence.
- Never infer building height or roof attributes when missing.
- Keep the release pinned; do not use a `latest` STAC pointer in a reproducible build.
- Do not commit a newly generated large extract or its secrets by default. Store output in the configured data-artifact location and publish its manifest/hash.
- The 8-county bbox is a discovery/extraction window, not an approved jurisdiction boundary or hydrologic AOI.
