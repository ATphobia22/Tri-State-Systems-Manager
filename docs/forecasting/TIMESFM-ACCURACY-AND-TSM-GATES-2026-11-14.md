# TimesFM Forecasting Accuracy — TSM Gates (2026-11-14)

## What TimesFM-3 is
Google zero-shot time-series foundation model (multivariate + covariates). Top-ranked among pretrained models on GIFT-Eval, FEV-Bench, and TIME for point and probabilistic metrics (Google evaluation).

## Accuracy summary (external studies)

| Context | Finding |
|---------|---------|
| Foundation benchmarks | Best average rank vs Chronos-2, Toto 2.0, TimesFM-2.5 |
| Simulation vs classical (36 scenarios) | Never worse than 1.31× best method; classical methods ≥2.2× worse somewhere |
| Strong seasonality + ≥4 cycles | AutoARIMA often 21–24% better than TimesFM-3 |
| Groundwater (10-day, weather covariates) | TimesFM-3 halves persistence error; with forecast-day weather ~0.54 median error ratio vs persistence |
| 80% interval coverage | ~0.80–0.83 across lengths (well calibrated in reported tests) |

## TSM use policy

- **Role:** screening / nowcast support for gage stage series (e.g. 03378500, 03322000) — **not** regulatory BFE or NFIP determination.
- **Label:** outputs `SIMULATION_DEMO` or screening until human-authorized evidence package.
- **Prefer:** covariate mode when QPE/radar or forecast precip available; univariate otherwise.
- **Do not:** replace USGS NWPS official forecasts, HEC-RAS profiles, or IDNR e-FARA with TimesFM alone.
- **Gate:** compare MASE/coverage against seasonal naive and last official NWPS issuance before any operational claim.

## Integration note
`packages/forecasting` remains contract-level. Wire TimesFM only behind fail-closed adapters and ADR-006 autonomy ladder (S1 default).
