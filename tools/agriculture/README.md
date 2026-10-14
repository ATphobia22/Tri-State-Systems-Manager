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
- Downloads USDA Cropland Data Layer for Posey County
- Annual 30m crop maps, 1997-present, public domain

**SSURGO Query** (`scripts/query-ssurgo-soils.py`)
- Queries soil data via USDA SDA API (no auth required)
- Note: API was returning 400s on 2026-10-13; may be temporary

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
# 1. Get soil data (when SDA API is available)
python3 tools/agriculture/scripts/query-ssurgo-soils.py

# 2. Explore FarmVibes.AI workflows
cd tools/agriculture/farmvibes-ai
ls notebooks/

# 3. See the full stack guide
cat tools/agriculture/docs/AGRICULTURE-STACK.md
```
