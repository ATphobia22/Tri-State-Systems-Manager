# Production HLOD asset acquisition playbook

**Policy:** Gate 4 reports `hlod_production_certified: false` until real mesh assets exist on disk. JSON ingest receipts alone are not production HLOD.

## Authorized sources

| Asset | Authoritative channels | Target path | Verification |
|-------|------------------------|-------------|--------------|
| USGS 3DEP lidar / DEM | USGS National Map, Indiana / Purdue 3DEP distribution (e.g. Poseyville quad) | `data/raw_usgs/*.{laz,las,tif}` | SHA-256 pinned in source manifest; ECEF envelope |
| Building footprints | IndianaMap / IGIO statewide programs | `data/raw_vectors/posey_buildings.geojson` | CRS explicit; ECEF/AOI spatial check |
| Topobathy / XS | USACE Louisville / ERDC confluence products where public | `data/raw_hydro/` | CRS + vertical datum documented |
| HEC-RAS HDF5 | Agency DFIRM / model releases (read-only) | `tiles/posey_county_offline/hec_ras/` | Read-only adapter schema; no calibration claim |

## Steps

### 1. Create raw directories

```bash
mkdir -p data/raw_usgs data/raw_vectors data/raw_hydro assets/production_hlod
```

Place official downloads under the matching folder. Do **not** commit multi-GB LAZ to Git; pin hashes and URLs in the registry instead.

### 2. Hash and register

```bash
sha256sum data/raw_usgs/your_tile.laz
```

Add a **tile-level** record to `integrations/registry/tsm-immutable-source-manifest-v1.json` (or a linked tile manifest) with:

- `url` (official download or index URL)
- `sha256` (measured)
- horizontal CRS
- vertical datum **as published by the product**
- optional `geoid_model` only when product metadata supports it

Example shape (replace values with measured ones):

```json
{
  "id": "usgs-3dep-posey-tile-example",
  "agency": "USGS",
  "title": "Posey County 3DEP tile (example)",
  "url": "https://apps.nationalmap.gov/",
  "sha256": "<measured_hex>",
  "crs": "product-native",
  "vertical_datum": "confirm_product_metadata",
  "verification_state": "HASH_PINNED"
}
```

### 3. Provenance-safe ingest

`geoid_offset_m` must come from a **product-specific** GEOID18/VDatum sample — never treat a single constant (e.g. 34.21) as universal Posey truth.

```bash
python scripts/geospatial/tsm_data_ingestor.py \
  --tile your_tile.laz \
  --expected-sha256 "<measured_hex>" \
  --ellipsoidal-height-m <from_product_or_omit> \
  --geoid-offset-m <from_GEOID18_sample> \
  --geoid-model-id GEOID18 \
  --geoid-source-url https://geodesy.noaa.gov/GEOID/GEOID18/
```

Omit vertical flags if you only verify checksum + ECEF; heights stay unlabeled as NAVD88.

### 4. Build real HLOD / GLB

1. Convert validated terrain/buildings to GLB + `tileset.json`.
2. Place under `tiles/posey_county_offline/`.
3. Set root extras authority **away from** `DERIVED_STAGING`.
4. Run:

```bash
python scripts/geospatial/tsm_ecef_validator.py
python scripts/release/tsm_certify_hlod_shipping.py
python scripts/release/tsm_master_verification_suite.py
```

### 5. Shipping (separate)

Only after HLOD cert: BuildCookRun + `Test-TSMShippingRuntime.ps1 -RequireAirGap`, then:

```bash
python scripts/release/tsm_master_verification_suite.py \
  --require-production \
  --shipping-exe Binaries/Win64/TriStateSystemsManager.exe \
  --airgap-log path/to/acceptance.log
```

Human authority remains final.
