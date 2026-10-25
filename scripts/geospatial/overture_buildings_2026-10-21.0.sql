-- TSM bounded Overture Buildings extraction contract.
-- Release is intentionally immutable; do not replace with a latest pointer.
-- Run with DuckDB CLI after installing/loading the spatial and httpfs extensions.
-- Output path is relative to the repository root.
LOAD spatial;
LOAD httpfs;
SET s3_region = 'us-west-2';

COPY (
  SELECT
    id,
    names.primary AS name,
    height,
    ground_elevation,
    roof_shape,
    roof_height,
    sources[1].dataset AS source_dataset,
    sources[1].record_id AS source_record_id,
    geometry
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings/type=building/*',
    hive_partitioning = 1
  )
  -- Bbox intersection, not containment: retain footprints crossing AOI edges.
  WHERE bbox.xmax >= -88.5
    AND bbox.xmin <= -87.0
    AND bbox.ymax >= 37.5
    AND bbox.ymin <= 38.5
) TO 'data/buildings/overture_buildings_2026-10-21.0.geojson'
WITH (FORMAT GDAL, DRIVER 'GeoJSON', SRS 'EPSG:4326');
