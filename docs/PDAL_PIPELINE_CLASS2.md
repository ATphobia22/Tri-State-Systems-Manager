# PDAL Pipeline Syntax — Class-2 Ground Extraction (PTDT v35)

PDAL pipelines are JSON arrays of stages. Each stage has a `type` and stage-specific options.
Execution is sequential: output of stage *n* feeds stage *n+1*.

## Minimal Class-2 (bare-earth) pipeline

```json
[
  {
    "type": "readers.las",
    "filename": "/data/spatial/posey_county/raw_lidar/input_tile.las"
  },
  {
    "type": "filters.range",
    "limits": "Classification[2:2]"
  },
  {
    "type": "filters.outlier",
    "method": "statistical",
    "mean_k": 8,
    "multiplier": 3.0
  },
  {
    "type": "writers.gdal",
    "filename": "/data/spatial/posey_county/processed/hydro_dem.tif",
    "resolution": 1.0,
    "output_type": "min"
  }
]
```

| Stage | Role |
|---|---|
| `readers.las` | Ingest LAS/LAZ point cloud |
| `filters.range` | Keep only Classification == 2 (ground) |
| `filters.outlier` | Statistical noise removal |
| `writers.gdal` | Rasterize min-Z to GeoTIFF (LAG-capable) |

## County-wide merge variant

```json
{
  "pipeline": [
    { "type": "readers.las", "filename": "lidar_data/Posey/*.las" },
    { "type": "filters.merge" },
    { "type": "filters.range", "limits": "Classification[2:2]" },
    { "type": "writers.las", "filename": "outputs/PoseyCounty_Ground.las" }
  ]
}
```

Run: `pdal pipeline class2.json`

CRS lock: ensure source LAS SRS is EPSG:2966 or reproject before LAG extraction. Vertical: NAVD88.
