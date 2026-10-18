# Flood Forecasting Integration

This directory contains the TSM flood forecasting pipeline, integrating
open-source models from Google Research.

## Scripts

| Script | Purpose |
|--------|---------|
| `timesfm-gage-nowcast.py` | **Layer 1:** Zero-shot river level forecasting at USGS/NWS gages using TimesFM 3.0. No training required. |
| `tsm-tristate-openhydronet-config.yml` | **Layer 2:** OpenHydroNet basin configuration for Ohio/Wabash tri-state watersheds. |
| `prepare-static-attributes.py` | Assembles static catchment attributes (3DEP topography, TESSERA land cover, SSURGO soils) for OpenHydroNet. |
| `weathernext-forcing.py` | **Layer 3:** Pulls WeatherNext 2 precipitation/temperature forecasts as dynamic forcing. |
| `tessera-tristate-download.py` | Downloads TESSERA 128-dim land embeddings (2017–2025) for the tri-state bbox. |

## Execution Order

1. `timesfm-gage-nowcast.py` — works today, no training
2. `tessera-tristate-download.py` — run on your machine (S3 access needed)
3. `prepare-static-attributes.py` — needs basin polygons + DEM + TESSERA
4. `tsm-tristate-openhydronet-config.yml` — place in flood-forecasting clone, train
5. `weathernext-forcing.py` — connect precipitation feeds

## Source Repos (forked under ATphobia22)

- `flood-forecasting` — OpenHydroNet (Google FloodHub framework)
- `timesfm` — TimesFM 3.0 time series foundation model
- `weathernext` — WeatherNext 2 atmospheric forecasting
- `flow-forecast` — Alternative PyTorch flood forecasting
- `google-research` — Monorepo reference

Full plan: `docs/tsm-flood-forecasting-integration-plan.md`
