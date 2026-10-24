# TSM Fork Integrations — Flood Forecasting Stack

**Date:** 2026-10-18
**Forks:** ATphobia22/hydromt, ATphobia22/hfsubsetR, ATphobia22/wres-explorer
**Local clones:** `~/workspace/forks/`

**2026-10-23 addition:** OpenHydroNet (Google FloodHub operational models) —
integrated as a *reference* adapter, not a vendored fork (see §4).

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

## 4. OpenHydroNet → FloodHub Hydrological LSTM (2026-10-23)

**Source:** https://github.com/googlehydrology/googlehydrology (fork of
NeuralHydrology; Google's operational FloodHub models) — **Apache-2.0 LICENSE
verified** in the local clone at `~/workspace/tmp-pulls/openhydronet/`.
**Integration:** `scripts/flood-forecasting/openhydronet_tristate.py`
**Pipeline step:** `python run_all.py --step openhydronet` (Step 11)
**Tri-state run config:** `scripts/flood-forecasting/tsm-tristate-openhydronet-config.yml`
(Ohio/Wabash basins, mean-embedding LSTM, 7-day horizons, transfer-learning plan)

### Integration choice: REFERENCE, not vendored

The framework is **not copied into this repo**. The adapter resolves it at
runtime from `$OPENHYDRONET_HOME` (default `~/workspace/tmp-pulls/openhydronet`),
verifies the Apache-2.0 LICENSE file, and imports `googlehydrology` from the
clone. Reasons:

1. **License hygiene** — vendoring a 3rd-party Apache-2.0 codebase into TSM's
   repo would freeze a copy that drifts from upstream; referencing keeps one
   canonical checkout to update and re-verify.
2. **Size** — the clone carries training configs, tutorials, catchment
   tooling, and docs TSM does not ship; TSM only needs the `modelzoo`
   architecture at inference time.
3. **Zero lock-in** — the adapter degrades honestly (UNAVAILABLE with a reason)
   when the checkout is absent, per the resilient-not-fail-closed policy.

### What the adapter does (VERIFIED 2026-10-23)

`openhydronet_tristate.py` runs a genuine smoke test of the operational
FloodHub architecture:

- Builds a toy-scale framework `Config` for `mean_embedding_forecast_lstm`
  (hidden 32, seq 30, lead 3, regression head) in dev mode.
- Writes a **real identity scaler** (center=0/scale=1, legacy `scaler.nc`)
  into a temp `run_dir`, because the framework's `BaseModel` genuinely
  requires `Scaler.load()` at construction. The scaler is labeled SYNTHETIC:
  it was not computed from real data and normalizes nothing.
- Instantiates `MeanEmbeddingForecastLSTM` via the framework's `get_model()`
  (17,425 parameters) and runs a forward pass on **SYNTHETIC** random input
  (clearly labeled): output `y_hat` shape `[2, 30, 1]`, all finite.
- Parses the tri-state config yml as the architectural reference.

Smoke result: **VERIFIED** — model constructs and runs end-to-end on CPU.
Smoke values are random-input artifacts, never presented as forecasts.

### NOT DONE (honest labels)

Production training is **not** built. The config yml's two-phase plan
remains open: (1) catchment delineation for the 3 tri-state basins from the
3DEP DEM, (2) static attribute table (SSURGO/3DEP/TESSERA/PRISM),
(3) dynamic forcing stack (NOAA CPC/IMERG/RTMA + ERA5-Land hindcast),
(4) Caravan-pretrained weights for transfer learning, (5) training on
tri-state gage targets. Until then the step is a smoke test only.

### Install / usage

```bash
# Framework checkout (one canonical clone; default path is baked in)
git clone https://github.com/googlehydrology/googlehydrology \
  ~/workspace/tmp-pulls/openhydronet
export OPENHYDRONET_HOME=~/workspace/tmp-pulls/openhydronet   # optional

# Runtime deps into the TSM torch venv (venv-local only)
~/workspace/torch-venv/bin/pip install pydantic ruamel.yaml xarray dask \
  more-itertools scipy pytest

# Run
cd scripts/flood-forecasting
~/workspace/torch-venv/bin/python openhydronet_tristate.py           # smoke run
~/workspace/torch-venv/bin/python openhydronet_tristate.py --check   # presence only
~/workspace/torch-venv/bin/python run_all.py --step openhydronet     # pipeline
~/workspace/torch-venv/bin/python -m pytest tests/test_openhydronet_tristate.py
```

Behavior is resilient: a missing checkout, bad license, or failed import
yields `UNAVAILABLE` with a reason (exit 1) — never a silent block, never
fail-closed.

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
| 11 | **OpenHydroNet Smoke** | **NEW — FloodHub LSTM smoke run (SYNTHETIC input)** |
