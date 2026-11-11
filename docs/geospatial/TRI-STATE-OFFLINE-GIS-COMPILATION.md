# Eight-county offline GIS compilation

The build converts **existing repository sources**, not invented geospatial
features. Coverage is eight county-scoped TIGER 2024 road and linear-water
archives (IN: 18051, 18129, 18163, 18173; IL: 17059, 17193;
KY: 21101, 21225). Posey County (18129) receives one separate DEM
screening product clipped by the source county boundary.

```bash
python -m pip install -r scripts/geospatial/requirements-offline-gis.txt
python -m unittest discover -s tests/offline_gis -v
python scripts/geospatial/compile_tri_state_offline_layers.py \
  --repo-root . --output /tmp/tsm-eight-county-offline-gis
python scripts/geospatial/verify_tri_state_offline_layers.py \
  --manifest /tmp/tsm-eight-county-offline-gis/offline-layers-manifest.json
```

Pull requests launch `.github/workflows/tri-state-offline-gis.yml`, uploading
an **unreviewed** generated artifact (not adding generated binary files to Git).
The artifact contains 16 EPSG:4326 GeoJSON vector layers, a clipped native
CRS GeoTIFF, a visualization-only PNG, and a SHA-256 manifest. Integrate
GeoJSON with a **local file or native tile reader** after independent device
tests; MapLibre cannot consume this output as PMTiles unless the existing
Tippecanoe PMTiles conversion is separately executed. Unreal and SceneKit
cannot treat GeoJSON as a precompiled 3D scene without their respective
geometry/mesh adapters. No automatic 3D Tiles, HLOD, terrain physics or
rendering certification is claimed by this conversion.

The TIGER line archives are *county-scoped inputs*, not verified parcel
boundaries or a calibrated hydrologic AOI. IL/KY terrain, authoritative
county-edge hydrography, WRI downloaded rasters and incomplete FEMA NFHL
or parcel datasets are **not** synthesized. The raster output preserves
the input's CRS, pixels and nodata; no NAVD88/ellipsoid/geoid conversion
is performed. Source-specific vertical datum and source pixel units still
require review, even when metadata exists.

The prior acquisition audit at
`data/acquisitions/offline-bundle-20261001/pipeline-report.json` recorded
size mismatches for NFHL 17059 and 21101 and failures for parcel data
in 17193, 21101, 21225 plus NFHL 21225; these are explicit upstream
release gates, **not** repaired by creating visualization layers.

Source URLs and independently acquired checksums must be reconciled against
official US Census TIGER, Indiana GIO, FEMA and state GIS metadata. Manifest
SHA-256 checks verify local bytes only; they are not scientific validation,
survey control or permit eligibility.
