# TSM Flood Forecasting Integration Plan

**Date:** 2026-10-18
**Status:** Planning — all source repos forked, wiring not yet started

## The Arsenal (all forked under ATphobia22)

| Repo | What it is | Role in TSM |
|------|-----------|-------------|
| `flood-forecasting` | **OpenHydroNet** — the actual Google FloodHub riverine forecasting framework (PyTorch, LSTM, Apache 2.0) | Primary flood model. Train/fine-tune on Ohio/Wabash basins. |
| `timesfm` | TimesFM 3.0 — Google's zero-shot time series foundation model | Gage nowcasting. No training needed — feed gage history, get forecasts. |
| `flow-forecast` | PyTorch flood forecasting (transformers, GRUs, attention) | Alternative/deeper architecture. Compare against OpenHydroNet. |
| `weathernext` | WeatherNext 2 — global atmospheric + cyclone forecasting (DeepMind) | Precipitation/temperature forcing inputs for the flood models. |
| `google-research` | Monorepo | Reference. Flood code not confirmed in fork. |

## Data You Already Have (inputs)

| Input type | Source | Status |
|-----------|--------|--------|
| Gage records | 03381700 (Ohio @ Old Shawneetown), 03378500 (Wabash @ New Harmony), MTVI3 (Mt Vernon) | Downloaded |
| Terrain | USGS 3DEP 1m, Indiana 2020 DEM | In repo |
| Watershed boundaries | TIGER 2024 | Downloaded |
| Soils | SSURGO (county symbols on file) | Partial |
| Land cover | TESSERA embeddings (script ready) | Download pending |
| Hydraulic models | DNR HEC-RAS 4449, 8778, 3551, McFadden Creek set | In repo |
| Precipitation/temperature | NOAA (via existing river-data policy) | Fetch on demand |

## Integration Layers

### Layer 1: Nowcasting (days 0–2) — TimesFM
- **Input:** Historical gage levels from 03381700, 03378500, MTVI3
- **Output:** 0–48 hour river level forecasts, zero-shot
- **Compute:** CPU-friendly, runs locally
- **Action:** Clone `timesfm` fork, load TimesFM 3.0 checkpoint from HuggingFace, feed gage CSVs

### Layer 2: Short-range flood forecasting (days 0–7) — OpenHydroNet
- **Input:** Static catchment attributes (3DEP topography, SSURGO soils, TESSERA land cover) + dynamic meteorological forcing (precipitation, temperature from WeatherNext or NOAA)
- **Output:** Daily streamflow predictions at basin outlets
- **Training:** Start from Caravan dataset (includes US basins), fine-tune on Ohio/Wabash gage records
- **Compute:** GPU recommended for training, CPU for inference
- **Action:** Clone `flood-forecasting` fork, follow the tutorial notebook, prepare basin config for the tri-state watersheds

### Layer 3: Meteorological forcing — WeatherNext 2
- **Input:** Global atmospheric state
- **Output:** Precipitation and temperature forecasts feeding Layer 2
- **Action:** Use pre-computed forecast data feeds (Google Cloud) rather than running the model — lighter weight

### Layer 4: Experimental — flow-forecast
- **Role:** Benchmark alternative. Train transformer/GRU architectures on the same inputs as Layer 2, compare against OpenHydroNet LSTM.
- **Action:** Lower priority. Useful for validation, not the primary path.

## Wiring Order

1. **TimesFM nowcasting** (fastest win — no training, works today)
2. **TESSERA download** (run the script — inputs for Layer 2)
3. **OpenHydroNet basin setup** (configure tri-state watersheds, prepare static attributes from 3DEP/SSURGO/TESSERA)
4. **OpenHydroNet fine-tuning** (Caravan pre-trained → fine-tune on 03381700/03378500 records)
5. **WeatherNext forcing** (connect precipitation feeds)
6. **flow-forecast comparison** (validate, don't block on this)

## License Check
- OpenHydroNet: Apache 2.0 ✅
- TimesFM: Apache 2.0 ✅
- flow-forecast: check repo (originally MIT-style open source)
- WeatherNext 2: Apache 2.0 ✅
- TESSERA data: CC-BY-SA ✅ (share-alike — derived products must carry same license)

All compatible with the zero-lock-in, open-source conviction. No API keys, no cloud dependency for inference.

## Open Questions
- [ ] Exact input format OpenHydroNet expects for custom basin attributes (check tutorial notebook)
- [ ] Whether Caravan already includes the Ohio/Wabash basins (check basin list)
- [ ] GPU availability for OpenHydroNet fine-tuning (CPU training is possible but slow)
- [ ] flow-forecast license confirmation
