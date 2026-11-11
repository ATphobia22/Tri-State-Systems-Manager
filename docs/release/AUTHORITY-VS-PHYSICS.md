# Human authority vs physical certification

Human authority is final on **policy, release decisions, and LOMA correspondence**.

Human authority does **not** create:

- Valid SHA-256 digests for files not on disk
- USGS 3DEP point clouds or IndianaMap footprints from equations alone
- A UE5.8 Shipping `.exe` without BuildCookRun on a Windows runner with the engine installed

Invented hashes (e.g. sequential hex strings) are **rejected** by the project’s integrity policy.

## What is automated on main

| Artifact | Role |
|----------|------|
| `scripts/build/Build-TSMShipping.ps1` | RunUAT BuildCookRun wrapper |
| `scripts/native/Test-TSMShippingRuntime.ps1` | Air-gap acceptance |
| `scripts/geospatial/tsm_data_ingestor.py` | Provenance-safe ingest |
| `scripts/release/tsm_master_verification_suite.py` | Gates 1–4 (honest) |
| `integrations/registry/tsm-posey-production-acquisition-registry-v1.json` | Portal registry, `sha256: null` until measured |

## Operator path to Gate 4 true

1. Download Posey 3DEP from Purdue/IGIC/USGS portals → `data/raw_usgs/`
2. `sha256sum` → set real digests in registry
3. Ingest with product-specific GEOID provenance
4. Build real GLB + tileset (not DERIVED_STAGING)
5. BuildCookRun + air-gap test on Windows 11
6. `python scripts/release/tsm_master_verification_suite.py --require-production ...`

Until then: `hlod_production_certified: false` and `ue58_shipping_airgap_certified: false` are **correct**.
