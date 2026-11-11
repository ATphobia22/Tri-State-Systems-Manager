# Gate 4 — Production HLOD & UE5.8 Shipping (honest)

## What Gate 4 does

Reports evidence status. It does **not** print “Shipping certified” when binaries are missing.

| Condition | Result |
|-----------|--------|
| tileset `DERIVED_STAGING` or 0 GLB | `hlod_production_certified=false` |
| non-staging tileset + GLB &gt; 0 | `hlod_production_certified=true` |
| Shipping `.exe` + air-gap log present | `ue58_shipping_airgap_certified=true` |
| JSON receipts only under `assets/production_hlod` | **not** mesh certification |

## Commands

```bash
# Harness (default): gates 1–3 must pass; Gate 4 only reports
python scripts/release/tsm_master_verification_suite.py

# Strict production gate
python scripts/release/tsm_master_verification_suite.py \
  --require-production \
  --shipping-exe Binaries/Win64/TriStateSystemsManager.exe \
  --airgap-log path/to/tsm_acceptance_test.log

# Standalone certifier
python scripts/release/tsm_certify_hlod_shipping.py --require-full
```

Provenance-safe ingest: `scripts/geospatial/tsm_data_ingestor.py`  
(also `scripts/ingest/tsm_data_ingestor.py` wrapper)

Human authority remains final.
