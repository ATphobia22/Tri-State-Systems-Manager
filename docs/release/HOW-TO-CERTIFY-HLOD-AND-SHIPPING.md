# How to certify production HLOD and UE5.8 Shipping

Certification is **evidence-based**. Scripts never invent a Shipping pass.

## 1. Provenance-safe ingest

```bash
python scripts/geospatial/tsm_data_ingestor.py --init-only

# Stage a tile only with explicit vertical provenance when claiming NAVD88:
python scripts/geospatial/tsm_data_ingestor.py \
  --tile my_tile.laz \
  --expected-sha256 <hex> \
  --ellipsoidal-height-m 120.0 \
  --geoid-offset-m <from_GEOID18_sample> \
  --geoid-model-id GEOID18 \
  --geoid-source-url https://geodesy.noaa.gov/GEOID/GEOID18/
```

No hard-coded site geoid offset. Missing provenance → heights stay unlabeled as NAVD88.

## 2. Production HLOD (not DERIVED_STAGING)

1. Build real GLB/HLOD content for Posey offline package.
2. Write `tiles/posey_county_offline/tileset.json` with non-staging authority extras.
3. Place `.glb` files under the tileset directory.
4. Run ECEF validator: `python scripts/geospatial/tsm_ecef_validator.py`
5. Run certification:

```bash
python scripts/release/tsm_certify_hlod_shipping.py
```

`hlod_production_certified` is true only when tileset exists, GLB count &gt; 0, and authority is not `DERIVED_STAGING`.

## 3. UE5.8 Shipping + air-gap

1. BuildCookRun on authorized Windows runner (see `MILESTONE-B-AIRGAP-SHIPPING-GATE.md`).
2. Run `scripts/native/Test-TSMShippingRuntime.ps1 -RequireAirGap`.
3. Pass evidence into the certifier:

```bash
python scripts/release/tsm_certify_hlod_shipping.py \
  --shipping-exe /path/to/TriStateSystemsManager.exe \
  --airgap-log /path/to/tsm_acceptance_test_*.log \
  --require-full
```

## 4. Master suite (harness only)

```bash
python scripts/release/tsm_master_verification_suite.py
```

Passes docs/ECEF/archive gates; does **not** set Shipping certified.

Human authority remains final.
