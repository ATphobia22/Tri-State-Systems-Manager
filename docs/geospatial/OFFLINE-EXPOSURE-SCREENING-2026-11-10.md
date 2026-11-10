# Offline impact screening — topology only

This module extends the approved local incident-layer catalog from PR #538
without introducing a cloud service or claiming to implement hydrodynamic modeling.

## What is actually computed

`backend/geospatial/offline_exposure.py` loads two SHA-256-verified
EPSG:4326 GeoJSON layers: a polygon hazard/context layer and a point,
line or polygon asset layer. It uses Shapely's exact `intersects`
predicate and counts **unique assets** intersecting one or more hazard
polygons. It reports the number of source features, counts, both file
hashes and explicit scientific limitations. It never returns parcel
ownership, depth, damages, flood recurrence or a FEMA determination.

It refuses missing/invalid data, invalid geometries, two derived-only
sources, incorrect hazard style and a Cartesian product over 1,000,000
pairs. No geometry repair or elevation transformation is implicit.

## Operator invocation

```powershell
Set-Location C:\Tri-State-Systems-Manager
python -m pytest backend/tests/test_offline_exposure.py -q
python scripts/geospatial/screen-offline-exposure.py `
  --root "C:\TSMData\regional\incidents" `
  --hazard "reviewed-hazard-polygon-layer" `
  --assets "reviewed-asset-layer" `
  --output "C:\TSMData\evidence\screening-receipt.json"
```

The example layer IDs must correspond to operator-approved entries in
`layers.json`. The output path must not exist already. A screen is
not a model run, engineering certification, risk index, emergency alert,
regulatory map, BFE determination, or substitute for HEC-RAS calibration.
A polygon can indicate an *overlap* only after the source effective
dates, coverage and positional accuracy are verified.

## Planned next gates

- Reproject and clip authoritative regional source snapshots with exact
  county boundaries and source-CRS evidence.
- Add a reviewed layer picker to the existing MapLibre UI and a distinct
  Unreal offline-data import path. Neither is wired by this CLI.
- Benchmark spatial-index batching and tiled processing before any
  full-county high-cardinality screening.
- Separate Rasterio/Xarray raster summary and segmentation candidate
  metadata from engineering-grade elevation/datum validation.
- Review GeoAgent and segmentation model licenses and human approval
  boundaries before any optional local plugin installation.
