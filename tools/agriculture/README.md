# TSM Agricultural Stack

Open-source agricultural mapping components integrated into the Tri-State Systems Manager.

## Components

### 1. FarmVibes.AI (Microsoft, MIT)
**Status:** Cloned to `farmvibes-ai/` (v2026.10, 1045 files)

Satellite + weather ML pipeline for agriculture. Data ingestion, fusion workflows,
crop classification, yield prediction.

**To use:**
```bash
cd tools/agriculture/farmvibes-ai
# See farmvibes-ai/docs/ for workflow guides
# Notebooks in farmvibes-ai/notebooks/ demonstrate key workflows
```

**Key workflows for TSM:**
- `data_ingestion` — Download Sentinel-2, NAIP, CDL, weather data
- `crop_classification` — Classify crops from satellite imagery
- `yield_prediction` — Predict yields from fused data

### 2. USDA Data Scripts

**CDL Fetcher** (`scripts/fetch-usda-cdl.py`)
- Opt-in STAC discovery, source-year checks, and rasterio masking against the official Posey GEOID 18129 polygon
- National CDL is annual 30 m from 2008 onward; vintage may not yet exist for the current year
- Produces a county-clipped *derived categorical* GeoTIFF plus source receipt and SHA-256 (never an individual farm record)

**SSURGO Query** (`scripts/query-ssurgo-soils.py`)
- Opt-in bounded USDA NRCS SDA requests using the documented `legend → mapunit → component` survey key joins
- `JSON+COLUMNNAME` validation, exact input snapshot hashes, immutable raw response files, and offline replay
- Retries transient errors and returns unavailable on malformed/truncated data; soil horizons are depths below local surface, not NAVD88 elevations

### 3. Documentation
- `docs/AGRICULTURE-STACK.md` — Full guide: datasets, tools, standards

## Integration with TSM

Agricultural data flows into the TSM data fabric alongside existing layers:

```
Hydrology → Flood → Terrain → Imagery → Parcels → Agriculture → 3D Twin
```

All agricultural components follow TSM provenance rules:
- Source, vintage, CRS, license recorded for every dataset
- Missing = unavailable, never fabricated
- Public domain preferred

## Quick Start

```bash
# 1. Acquire and preserve USDA soil map units (explicit network opt-in)
python3 tools/agriculture/scripts/query-ssurgo-soils.py --live --areasymbol IN129 --out private-data/ssurgo-posey.json

# 2. Acquire official-county-clipped annual CDL only when that year is released
python3 tools/agriculture/scripts/fetch-usda-cdl.py --live --year 2025 --out private-data/cdl-posey-2025.tif

# 3. Offline contract tests (no network or credentials)
python3 -m unittest discover -s tools/agriculture/scripts -p 'test_*.py' -v
python3 tools/agriculture/scripts/validate_source_catalog.py

# 2. Explore FarmVibes.AI workflows
cd tools/agriculture/farmvibes-ai
ls notebooks/

# 3. See the full stack guide
cat tools/agriculture/docs/AGRICULTURE-STACK.md
```


## Cross-sector evidence catalog (2026-10-25)

`data/registries/tsm-cross-sector-source-catalog-v1.json` registers agency
data and open-source candidates for survey, flood, emergency operations and
agriculture. All entries remain `CATALOG_ONLY`, without implicit network
access, signed evidence, model execution, farm-data publication or agency
approval. See `docs/agriculture/REGIONAL-AGRICULTURAL-EMERGENCY-ADOPTION-2026-10-25.md`.
