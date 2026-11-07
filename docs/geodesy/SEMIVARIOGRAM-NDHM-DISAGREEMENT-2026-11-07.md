# Semivariogram of inter-product nDHM disagreement — Posey County (2026-11-07)

## Honesty banner

**What this is:** an engineering-validation analysis of the spatial
structure of *inter-product disagreement* between two nDHM height
estimates at the same building footprints. It is **NOT** a FEMA or
survey certification, **NOT** LOMA evidence, and **NOT** absolute
elevation error against ground truth — no survey control exists in
this dataset. Outputs map only to an isolated uncertainty description
and must never be written to, or overwrite, a certified
lowest-adjacent-grade (LAG) slot.

- `r = (2020 nDHM interior-median height) − (Purdue NDHM 2017–2019 height)`,
  same footprint, metres. Both terms are nDHM *estimates* (DSM minus
  DEM). Their difference is disagreement between two products, not
  `z_DEM − z_survey`. Never call these values survey residuals.
- LOMA case 26-05-2022A: FEMA additional-information request
  (letter 2026-09-22), **NOT ISSUED**; 90-day track ends 2026-12-21.
- Regulatory BFE for the anchor site is **369.1 ft NAVD88** (FEMA FIS
  18129CV000A Table 9). It is context only and is not used in any
  computation here.

## Dataset and provenance

| Item | Value |
|---|---|
| Probe table | `ndhm-probe-per-id.csv` (nDHM probe, Gate 13, 2026-11-07), SHA-256 `161324d126c05c9fda7c684ecbd7fe7e0585aaab34a6074d6b839d2ccdac5443` |
| Footprints | Archived `posey-buildings-igio-23082.geojson`, SHA-256 `d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f` |
| Rows with both nDHM values | **1,893** of 2,565 probe rows (672 excluded: no Purdue NDHM 2017–2019 height — the 434 tile-metadata-unprobed IDs and the 240 IDs never in `buildings-3d.json`) |
| Footprint join | **1,893 / 1,893** joined on `sourceObjectId` = `objectid`; zero missing, zero invented |
| 2020 nDHM vintage | 2020 only (Posey QL2 collection); IGIO bucket `s3://giselevationingov/`, CC0 |
| Purdue NDHM vintage | 2017–2019 (Purdue Digital Forestry, via `buildings-3d.json`) |
| Run output (JSON) | `docs/geodesy/semivariogram-ndhm-disagreement-2026-11-07.json` |
| Script | `scripts/geospatial/semivariogram_ndhm_disagreement.py` |
| Tests | `scripts/geospatial/test_semivariogram_ndhm_disagreement.py` (14 tests, all passing) |

## Locations and CRS (verified, not assumed)

- The GeoJSON carries **no `crs` member**, so by RFC 7946 its
  coordinates are WGS84 longitude/latitude. Verified by range:
  lon −88.09…−87.69, lat 37.77…38.23. The script rejects coordinates
  outside decimal-degree ranges and refuses any embedded `crs` member
  it does not expect.
- Location per footprint = area-weighted centroid of the largest
  polygon's exterior ring (23,071 Polygon + 11 MultiPolygon features).
- Centroids projected EPSG:4326 → **EPSG:2966** (NAD83 / Indiana West,
  ftUS) with pyproj, then ftUS → metres with the exact US survey foot
  **1 ftUS = 1200/3937 m** (not the international foot 0.3048). A
  plausibility gate checks the projected coordinates fall in the
  Indiana West window for Posey County (observed E 2,672,066–2,778,831
  ftUS, N 929,291–1,087,244 ftUS).
- Pair distances are ground metres. `hypot(dx, dy)` is never computed
  in decimal degrees. Bounding-box diagonal 61,861 m.

## Method

Experimental (Matheron) semivariogram
`γ(h) = 1/(2N(h)) · Σ(r(xi) − r(xi+h))²`, 12 equal-width lag bins,
`max_dist` = 0.5 × bounding-box diagonal = **30,930 m**, bin width
**2,578 m**, pair-count threshold **N(h) ≥ 30** per bin (bins below it
are flagged unusable and excluded from fitting). Pairwise cost is
O(n²), chunked to bound memory: 1,893 points → 1,601,863 pairs within
`max_dist` (of 1,790,778 possible pairs).

**Empty-bin fix:** an earlier pasted `empirical_semivariogram` used
`counts = np.maximum(counts, 1)`, making empty bins report γ = 0 and
corrupting any fit. This implementation returns **NaN for zero-pair
bins, never 0** (regression-tested).

Spherical and exponential models fitted with SciPy `curve_fit`
(count-weighted) on usable bins only; the better model is picked by
the smaller fit RMSE against the binned γ values.

## Results — all 1,893 points

Global statistics of `r` (m): mean **0.0033**, median **0.00**,
std **0.3698**, RMSE vs zero **0.3697**, min **−4.348**, max **+11.999**;
**1,886 (99.6%)** agree within ±1 m; 7 disagree (the same 7 listed in
the probe report §6).

| Lag bin centre (m) | γ (m²) | Pairs |
|---:|---:|---:|
| 1,289 | 0.07825 | 138,816 |
| 3,866 | 0.17748 | 93,218 |
| 6,444 | 0.17207 | 108,855 |
| 9,021 | 0.13821 | 114,006 |
| 11,599 | 0.09752 | 145,898 |
| 14,176 | 0.21538 | 179,239 |
| 16,754 | 0.21782 | 165,464 |
| 19,332 | 0.08767 | 204,663 |
| 21,909 | 0.09676 | 162,064 |
| 24,487 | 0.14020 | 122,821 |
| 27,064 | 0.21839 | 97,455 |
| 29,642 | 0.11706 | 69,364 |

All 12 bins are usable (smallest count 69,364 ≫ 30). No bin is sparse.

### Model fits

| Model | Nugget (m²) | Sill (m²) | Total sill (m²) | Range (m) | Fit RMSE (m²) | R² |
|---|---|---|---|---|---|---|
| **Spherical (selected)** | 0.008992 | 0.141483 | 0.150475 | 3,797.8 | **0.046154** | 0.1641 |
| Exponential | 0.000000 | 0.150277 | 0.150277 | 4,136.8 | 0.046881 | 0.1375 |

**Selection:** spherical, by the stated criterion (smaller fit RMSE).
The margin is tiny (0.0462 vs 0.0469 m²) — the two models are
essentially tied. **Fit quality is poor (R² ≈ 0.16):** the binned γ
does not rise smoothly to a sill but scatters between 0.08 and
0.22 m² with no clear trend, so the fitted range (~3.8 km) is weakly
identified. Do not quote the range as a precise correlation length.

### Sensitivity: the signal is outlier-driven

Re-running with the 7 points with |r| > 1 m dropped
(`--sensitivity-drop-abs-gt 1.0`, n = 1,886) collapses the field:

- std of `r`: **0.0324 m** (vs 0.3698 m with all points);
  variance 0.00105 m² (vs 0.1367 m²).
- γ falls to **0.00011–0.00164 m²** and rises smoothly with lag.
- Spherical fit: nugget 0.000027 m², sill 0.001708 m²,
  range **55,845 m**, R² 0.7707 — but the range exceeds `max_dist`
  (30,930 m) and the study extent, so it is **not identified within
  this dataset**; only "still rising at 31 km" is supported.
- Exponential fit is similar (range 88,925 m, R² 0.7488).

Read plainly: the bulk of the two nDHM products agree to a few
centimetres at the same footprint, and essentially all of the
full-data semivariogram is carried by 7 footprints whose two
vintages disagree by 1–12 m (canopy change / roof-vs-tree ambiguity,
per the probe report). Any use of the full-data fitted parameters
must carry that caveat.

## Comparison vs the global 1.96×RMSE shortcut

The NSSDA 95% bound for the 3DEP dynamic service is **±1.04 m**
(1.96 × 0.53 m RMSE); for the 1/3″ seamless DEM, **±1.61 m**
(1.96 × 0.82 m). Those are global network accuracies of EPQS
elevations against ground truth — a *different quantity* from
inter-product disagreement, so the comparison below is a
scale-and-localization check, not a validation of either number.

The localized bound is ±1.96·√(2γ(h)) on the **change** in
inter-product disagreement between two footprints h apart, given the
disagreement at one of them (spherical model, all points):

| Lag h | Model γ (m²) | Localized 95% difference bound |
|---:|---:|---:|
| 500 m | 0.0368 | **±0.53 m** |
| 2,000 m | 0.1104 | **±0.92 m** |
| 5,000 m | 0.1505 | **±1.08 m** |
| 10,000 m | 0.1505 | **±1.08 m** |
| at fitted range (3,798 m) | 0.1505 | **±1.08 m** |
| asymptotic (h ≫ range) | 0.1505 | **±1.08 m** |

Reference values: global 1.96 × std(r) = **±0.72 m**;
NSSDA 95% dynamic = **±1.04 m**.

Where localization matters: at short lags (≤ ~2 km) nearby
footprints' disagreements track each other more tightly than the
global spread suggests (±0.53 m at 500 m vs ±0.72 m global). Where
it does not: beyond the fitted range the localized bound saturates at
±1.08 m, essentially the global figure — and the sensitivity run
shows the "global spread" itself is 7 outliers, with the bulk field
at ±0.06 m (1.96 × 0.0324 m). No lag bin was too sparse to support
localization (all counts ≥ 69,364), but the poor full-data fit
(R² 0.16) means the fitted curve, not the pair counts, is the weak
link — treat the localized bounds as indicative, not precise.

## Limits

- No survey control: nothing here measures absolute elevation error.
- The 434 tile-metadata-unprobed IDs are absent from this dataset;
  the 7 disagreements are unresolved per-ID cases, not a rule.
- The Matheron estimator squares differences, so it is
  outlier-sensitive (see sensitivity section); no robust
  (Cressie–Hawkins) estimator was computed.
- Footprint centroids stand in for footprints; footprint topology
  errors would propagate silently (none were flagged).
- Vintage mismatch: 2020 nDHM vs 2017–2019 Purdue NDHM; tree
  growth/removal between acquisitions explains the largest
  disagreements. Agreement is a consistency check, not validation.
- O(n²) pairwise cost: fine at n = 1,893 (~1.8M pairs, seconds);
  a county-wide run over all 23,082 footprints would need a
  spatial-index / subsampling strategy, not this brute-force loop.

## Deferred

The PostGIS migration for residual checkpoints (x, y, r) is
**deferred** — no migration was written, no number reserved. The
table design waits until the residual dataset is settled and
reviewed.

## Reproduce

```bash
# venv with numpy, scipy, pyproj (probe-venv pattern)
/tmp/ndhm-venv/bin/python scripts/geospatial/semivariogram_ndhm_disagreement.py \
  --csv <ndhm-probe-per-id.csv> \
  --footprints <posey-buildings-igio-23082.geojson> \
  --sensitivity-drop-abs-gt 1.0 \
  --out docs/geodesy/semivariogram-ndhm-disagreement-2026-11-07.json

/tmp/ndhm-venv/bin/python -m unittest \
  scripts.geospatial.test_semivariogram_ndhm_disagreement -v
```

SciPy 1.11.4 was present in the run environment, so no pure-NumPy
fallback was needed. `python3 -c "import scipy"` in the run env
reports 1.11.4; NumPy 1.26.4; pyproj 3.8.0.
