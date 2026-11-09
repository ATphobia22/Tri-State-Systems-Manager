# Posey County 2025 leaf-on imagery and DSM — official data ingestion

**Publisher:** Indiana Geographic Information Office. **Year:** 2025.
**License:** CC0 as declared in the state AWS Open Data registry.
These source files are not survey certificates or engineering-approved elevations.

## Official sources

- [2025 Indiana leaf-on catalog](https://registry.opendata.aws/in-imageryleafon/)
- [Indiana elevation archive](https://registry.opendata.aws/in-elevation/)
- [IGIO announcement (September 28, 2026)](https://www.in.gov/gis/geoinsights/posts/indiana-leafoff-and-leaf-on-imagery-updates/) names Posey as released.
- [Posey County 2025 six-inch imagery inventory](https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/tif/Posey2025tif.csv): 4,358 URL records, comprising 2,179 TIFF and 2,179 TFW world files.
- [Posey County 2025 DSM inventory](https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/dsm/Posey2025dsm.csv): 2,179 one-foot DSM TIFF URLs.

The inventories were independently read on November 9, 2026 using public S3 GetObject, and matching tile existence was checked through HeadObject.
**County inventory membership is not proof of coverage of municipal limits.**

## Bounded sample selected for the download workflow

| Source | Bucket | S3 key | Observed size |
|---|---|---|---:|
| Leaf-on RGB/NIR image | gisimageryleafoningov | imageryoptimized/2025/SPW/06in/in2025_27179775_06.tif | 110,910,337 bytes |
| DSM | giselevationingov | dsmoptimized/statewide/2025/SPW/1ft/in2025_27179775_06.tif | 33,610,309 bytes |

Both files were found in the official **Posey** county manifests.
They are verified candidate tile names only. Raster footprint overlap is checked against embedded CRS and raster bounds after download.

Use Python 3.12 plus rasterio:

    python -m pip install rasterio==1.4.3
    python scripts/geospatial/acquire_posey_2025_leafon.py \
      --output posey-2025-official --tile-stem in2025_27179775_06 \
      --max-tiles 1 --max-total-mib 200 --max-file-mib 150 \
      --raster-inspect

Omitting the --tile-stem flag downloads **only county CSV inventories**,
not 2,179 TIFF pairs. The program enforces exact matched stems, a fixed
S3 host/path allowlist, bounded bytes, SHA-256 receipts, a TIFF signature,
valid embedded horizontal CRS and paired footprint overlap when requested.
It never substitutes an S3 multipart ETag for SHA-256.

The workflow .github/workflows/posey-2025-leafon-dsm-acquisition.yml
downloads one pair and uploads its bytes, source inventory and receipt as a
time-limited GitHub Actions artifact. Do not commit large rasters to Git.

## Scientific interpretation and limitations

- **2020 classified LAS and bare-earth DEM:** candidate inputs to physical
  terrain/hydraulics after verifying source-specific vertical reference,
  sampling, units, datum grids, accuracy and project coverage. Earlier
  2020 LAS metadata states NAVD88/Geoid12B and NAD83(HARN)/Indiana West;
  that is not automatically equal to TSM's EPSG:2966/GEOID18 baseline.
- **2025 six-inch leaf-on imagery:** cinematic ground textures and
  multispectral context, not a standalone elevation or hydraulic source.
- **2025 one-foot DSM:** vegetation, roof and canopy surfaces or change
  detection candidates, **not** a bare-earth DEM or certified roof height.
  Different acquisition years require construction/demolition and vegetation
  screening before using derived heights.
- Clip to a verified city corporate-limit polygon by transforming the actual
  raster bounds; a rectangular area of interest is not a city boundary.
- For a truly independent engineering outcome, collect rooftop-classified
  LAS evidence, robust bare-earth ground samples, field checkpoints,
  accuracy thresholds and professional review. Numerical checks do not
  certify a survey, hydraulic model or floodplain determination.
- Native UE5.8 Windows Shipping packaging, clean offline launch,
  cinematic performance and TSMData provenance are **separate release gates**.

The receipt deliberately asserts engineering_approved: false,
source_authenticity_independently_attested: false, and
complete_city_coverage_verified: false until independently substantiated.
