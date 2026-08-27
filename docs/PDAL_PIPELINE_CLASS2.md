# PDAL Pipeline Syntax — Class-2 Ground Extraction

Pipelines are JSON arrays of stages executed in order.

```json
[
  { "type": "readers.las", "filename": "input_tile.las" },
  { "type": "filters.range", "limits": "Classification[2:2]" },
  { "type": "filters.outlier", "method": "statistical", "mean_k": 8, "multiplier": 3.0 },
  { "type": "writers.gdal", "filename": "hydro_dem.tif", "resolution": 1.0, "output_type": "min" }
]
```

| Stage | Role |
|---|---|
| readers.las | Ingest LAS/LAZ |
| filters.range Classification[2:2] | Keep ground only |
| filters.outlier | Statistical noise removal |
| writers.gdal output_type=min | Min-Z raster (LAG-capable) |

County merge: add `filters.merge` after multi-file readers. CRS: EPSG:2966. Vertical: NAVD88.
Run: `pdal pipeline class2.json`
