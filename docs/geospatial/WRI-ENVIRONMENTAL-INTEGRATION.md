# WRI environmental evidence staging for TSM

Sources discovered 2026-11-11: https://www.wri.org/resources ,
https://www.wri.org/data/data-applications ,
https://datasets.wri.org/ .
The catalogue is `data/registries/wri-environmental-catalog-v1.json`.
No source listed here is regulatory, calibrated, parcel-scale or an input to
automatic engineering approvals.

**Acquisition scope:** Aqueduct 4.0 water-risk indicators, Aqueduct Floods v2
regional comparative hazards, Dynamic World land-cover probabilities, and
Global Water Watch satellite water-body observations. WRI's Aqueduct 4.0
dictionary is copied under `third_party/wri/Aqueduct40/` with CC BY 4.0
attribution. The data catalog records are metadata snapshots, **not**
downloads of geospatial rasters or verified regional subset coverage.

**Important:** WRI Aqueduct Floods is based on older global modeling,
represents inundation depths at a coarse ~1 km scale, omits flood defences,
and is unsuitable for detailed flat-river backwater modeling or levee
assessment. It must NEVER replace effective FEMA NFHL, stage-to-NAVD88
measurements, or a calibrated USACE HEC-RAS result. Aqueduct water-risk
scores are regional screening indicators and are not site observations.

## Optional bounded asset acquisition (online preparation host only)

WRI catalog pages may supply a direct asset URL or ask for an email/request
or Earth Engine authorization. **Do not invent a URL or bypass access controls.**
After source-specific license review, supply the actual official HTTPS
download URL and a filename in an external offline-staging directory:

```bash
python scripts/wri/acquire_offline_asset.py \
  --source-id wri.aqueduct40.basins \
  --url 'https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip' \
  --output /external/tsm-staging/wri/aqueduct40.zip \
  --acknowledge-license-review
python -m unittest discover -s tests/wri -v
```

The ZIP link above was verified as the direct download target on WRI's official Aqueduct 4.0 page (2026-11-11). The downloader
requires a user-reviewed exact URL and enforces known WRI download hosts.
A successfully downloaded file gets a SHA-256, byte count and receipt marked
`ACQUIRED_UNREVIEWED`. It is **not** automatically imported into render or
regulatory pipelines. A matching digest is not proof of provenance.

## Data architecture and integration gates

1. Download official assets off the production device; preserve the raw source
   and WRI license + citation in a versioned external cache, **not Git LFS**.
2. Validate source layer/schema, dimensions, units, acquisition/model vintage,
   CRS and coverage. Use authoritative county polygons for Posey IN,
   Henderson/Union KY, White/Wabash/Gallatin IL. No inferred parcel match.
3. For Aqueduct baseline, join by native `pfaf_id` or documented WRI basin
   identifier, not by invented county code. Keep numerical `_raw`, `_score`,
   and `_cat` fields distinct.
4. Use GDAL/QGIS to clip vector/raster sources to validated AOI;
   preserve nonregulatory `WRI_COMPARATIVE` source class and source vintage.
5. Convert reviewed, projected scenes to offline raster/3D tile packages with
   per-tile SHA-256. Register UI layers as optional, disabled until evidence
   is reviewed. Never broadcast a simulated flood as a live observation.
6. iOS scene graph / Windows UE5.8 render activation, camera test, performance
   data, clean offline startup and external storage retrieval require separate
   independent acceptance evidence.

**No WRI geospatial asset or tile is claimed staged, clipped, rendered or
published on `main` by this catalog alone.**
