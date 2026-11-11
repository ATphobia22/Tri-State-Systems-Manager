# Production pipeline orchestrator

```powershell
.\scripts\release\Invoke-TSMProductionPipeline.ps1
.\scripts\release\Invoke-TSMProductionPipeline.ps1 -RequireProduction
```

Scans for `data/raw_usgs`, building footprints, tileset, GLB count, Shipping exe, and air-gap log, then runs `tsm_master_verification_suite.py`.

## Ingestor `--tile` rule

With default `--raw-dir data/raw_usgs`, pass **basename only**:

```bash
python scripts/geospatial/tsm_data_ingestor.py \
  --tile your_posey_tile.laz \
  --expected-sha256 "<measured>" \
  --ecef-x 175550.84 --ecef-y -5039980.67 --ecef-z 3892024.17 \
  --ellipsoidal-height-m 120.0 \
  --geoid-offset-m <from_GEOID18_sample> \
  --geoid-model-id GEOID18 \
  --geoid-source-url "https://geodesy.noaa.gov/GEOID/GEOID18/"
```

Do not use a hard-coded site geoid (e.g. 34.2100) unless that value is your measured sample for that tile.

Vertical formula: \(H = h - N\) (orthometric = ellipsoidal − geoid undulation), with model + URL required when claiming NAVD88.
