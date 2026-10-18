# TSM Fork Integrations — Flood Forecasting Stack

**Date:** 2026-10-18
**Forks:** ATphobia22/hydromt, ATphobia22/hfsubsetR, ATphobia22/wres-explorer
**Local clones:** `~/workspace/forks/`

## Overview

Three open-source forks are wired into TSM's flood-forecasting pipeline
(`scripts/flood-forecasting/`), extending `run_all.py` from 7 to 10 steps.

## 1. hydromt → SFINCS Flood Modeling

**Fork:** https://github.com/ATphobia22/hydromt (of Deltares/hydromt)
**Integration:** `scripts/flood-forecasting/hydromt_tsm_catalog.py`
**Pipeline step:** `python run_all.py --step hydromt`

Generates a HydroMT data catalog YAML pointing at TSM's local holdings:
- Posey County 2.5ft DEM (EPSG:2968, NAVD88)
- FIS Table 9 floodway data (BFE 369.1 ft NAVD88)
- Indiana DNR cross-sections (908 rows)

**Next:** Install `hydromt_sfincs` plugin + SFINCS binary to build the actual
2D model. See `docs/reference/hydromt-noaa-inundation-integration.md`.

## 2. hfsubsetR → NOAA Hydrofabric

**Fork:** https://github.com/ATphobia22/hfsubsetR (of owp-spatial/hfsubsetR)
**Integration:** `scripts/flood-forecasting/hydrofabric_subset.py`
**Pipeline step:** `python run_all.py --step hydrofabric`

R package wrapper for extracting NOAA hydrofabric subsets at the confluence.
Provides river network topology, COMIDs, and catchment boundaries from
spatial.water.noaa.gov.

**Usage:**
```bash
python hydrofabric_subset.py --print-r    # Show R script
python hydrofabric_subset.py --xy -88.005075 37.845887 --output ./confluence.gpkg
```

**Requires:** R + `remotes::install_github("ATphobia22/hfsubsetR")`

## 3. wres-explorer → NWM Forecast Evaluation

**Fork:** https://github.com/ATphobia22/wres-explorer (of NOAA-OWP/wres-explorer)
**Integration:** `scripts/flood-forecasting/wres_evaluation.py`
**Pipeline step:** `python run_all.py --step wres`

Evaluates National Water Model forecast skill at TSM gages (03381700, 03378500)
using the WRES framework. Tells us how much to trust NWM before using it
for flood forecasting.

**Requires:** `pip install ~/workspace/forks/wres-explorer`

## Pipeline Steps (Updated)

| Step | Name | Script |
|------|------|--------|
| 1 | Data Ingestion | USGS gage data |
| 2 | Antecedent Precipitation | CPC data |
| 3 | TimesFM Nowcasting | 0-48h |
| 4 | GEOGloWS Forecast | 10-day |
| 5 | Rating Curves | ras2fim |
| 6 | Flood Alert Check | Stage vs thresholds |
| 7 | BFE Synthesis | 369.1 ft NAVD88 |
| 8 | **HydroMT Catalog** | **NEW — SFINCS inputs** |
| 9 | **Hydrofabric** | **NEW — NOAA river network** |
| 10 | **WRES Evaluation** | **NEW — NWM skill assessment** |
