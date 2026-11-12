# DEM acquisition (USGS TNM)

## Status rules

- Do **not** mark a county downloaded/validated/imported without real rasters on disk and inspection results.
- `coverage_verified` and `vertical_datum_approved` stay **false** until human review.

## Tool

```bash
# Metadata only (safe default)
python scripts/geospatial/tsm_dem_acquire.py --counties posey_in

# Bounded download (operator must have network + disk)
python scripts/geospatial/tsm_dem_acquire.py --download \
  --counties posey_in vanderburgh_in \
  --max-file-gb 1 --max-county-gb 2 --max-total-gb 8
```

Report: `integrations/registry/tsm_dem_acquisition_report.json`

Outputs under `data/raw_usgs/tnm_dem/<county_id>/`.

## After download

1. Inspect CRS, nodata, units (rasterio / gdalinfo).
2. Pin SHA-256 in acquisition registry.
3. Provenance-safe vertical path via GEOID18 only with measured \(N\).
4. Only then build non-`DERIVED_STAGING` tiles / HLOD.

Human authority remains final.
