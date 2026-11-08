#!/usr/bin/env python3
"""Experimental semivariogram of inter-product nDHM disagreement (Posey County).

HONESTY BANNER — read before using any output of this script.

What the input ``r`` is
-----------------------
``r = (2020 nDHM interior-median height) - (Purdue NDHM 2017-2019 height)``
for the same building footprint, in metres. Both terms are nDHM *estimates*
(normalised height above ground, DSM minus DEM). Their difference is
**inter-product disagreement between two NDHM estimates at the same
footprint**. It is NOT ``z_DEM - z_survey``: there is no survey control in
this dataset, so this semivariogram describes the spatial structure of
inter-product disagreement, NOT absolute elevation error against ground
truth. Never call these values survey residuals, and never present any
output of this script as certified elevation error.

Scope
-----
ENGINEERING validation for TSM constraints only. This is NOT a FEMA or
survey certification, and semivariogram results are NOT LOMA evidence.
LOMA case 26-05-2022A has a FEMA additional-information request outstanding
(letter 2026-09-22); it is NOT ISSUED (90-day track ends 2026-12-21).
Regulatory BFE for the anchor site is 369.1 ft NAVD88 (FEMA FIS
18129CV000A Table 9); that value is context only and is not used in any
computation here. Outputs map only to an isolated uncertainty description;
they must never be written to, or overwrite, a certified
lowest-adjacent-grade (LAG) slot.

Method
------
Experimental semivariogram (Matheron estimator)::

    gamma(h) = 1 / (2 N(h)) * sum (r(xi) - r(xi+h))^2

over lag bins, with ``max_dist`` defaulting to 0.5 x the bounding-box
diagonal and a per-bin pair-count threshold of N(h) >= 30. Bins with
fewer pairs are flagged unusable and are never used in a model fit.

CODE DEFECT FIX (see research_notes/semivariogram-reference-sheet-
2026-11-07.md): an earlier pasted ``empirical_semivariogram`` used
``counts = np.maximum(counts, 1)``, which makes EMPTY bins report
gamma = 0 instead of unavailable and would corrupt any model fit.
This implementation returns NaN for zero-pair bins, never 0.

Spherical and exponential models are fitted with SciPy ``curve_fit``
(weighted by pair count) on usable bins only. The better model is picked
by the smaller fit RMSE; the criterion is stated in the output.

Distances are ground metres. Footprint locations come from the archived
Posey buildings GeoJSON, whose coordinates are WGS84 longitude/latitude
(no ``crs`` member, i.e. the RFC 7946 default; verified by coordinate
range). Polygon centroids are projected to EPSG:2966 (NAD83 / Indiana
West, US survey feet) with pyproj and converted with the exact US survey
foot, 1 ftUS = 1200/3937 m. ``hypot(dx, dy)`` is never computed in
decimal degrees.

Cost is O(n^2) pairwise distances (chunked to bound memory); fine for
n = 1,893 (~1.8M pairs) but noted for larger point sets.

Dependencies: numpy, scipy, pyproj (standard library otherwise).
Run with a Python that has them, e.g. the venv used for the nDHM probe
(``/tmp/ndhm-venv`` pattern: ``python3 -m venv --system-site-packages``
plus ``shapely``/``rasterio``/``pyproj``; this script itself needs only
numpy, scipy and pyproj).

Usage:
    python3 semivariogram_ndhm_disagreement.py \
        --csv ndhm-probe-per-id.csv \
        --footprints posey-buildings-igio-23082.geojson \
        --out semivariogram-ndhm-disagreement-2026-11-07.json
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

# Exact US survey foot (not the international foot 0.3048).
FTUS_TO_M = 1200.0 / 3937.0
# NSSDA 95% bound for the 3DEP dynamic service: 1.96 * 0.53 m RMSE.
NSSDA_DYNAMIC_RMSE_M = 0.53
NSSDA_95_M = 1.96 * NSSDA_DYNAMIC_RMSE_M  # 1.0388 m, reported as +/-1.04 m
# NSSDA 95% bound for the 1/3 arc-second seamless DEM: 1.96 * 0.82 m.
NSSDA_SEAMLESS_95_M = 1.96 * 0.82  # 1.6072 m, reported as +/-1.61 m

DEFAULT_MIN_PAIRS = 30
DEFAULT_N_LAGS = 12

# Plausibility window for EPSG:2966 coordinates of Posey County footprints
# (Indiana West, ftUS). Used only as a sanity gate after reprojection;
# the county's nDHM tile grid spans roughly E 2,670,000-2,780,000,
# N 929,000-1,088,000 ftUS. The window below is deliberately wider.
EASTING_FTUS_RANGE = (2_000_000.0, 3_000_000.0)
NORTHING_FTUS_RANGE = (500_000.0, 1_500_000.0)


# --------------------------------------------------------------------------
# Input loading
# --------------------------------------------------------------------------

def load_disagreement_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load (sourceObjectId, r) pairs with both nDHM values present.

    ``r`` is ``diff2020MinusPurdueM``: 2020 nDHM minus Purdue NDHM
    2017-2019, in metres — inter-product disagreement, NOT a survey
    residual. Rows missing either height, or with a non-finite
    difference, are excluded and counted.
    """
    ids: list[int] = []
    values: list[float] = []
    excluded = 0
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"sourceObjectId", "purdueNDHM2017_2019HeightM",
                    "diff2020MinusPurdueM"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path}: missing columns {sorted(missing)}")
        for row in reader:
            try:
                oid = int(row["sourceObjectId"])
                purdue = float(row["purdueNDHM2017_2019HeightM"])
                diff = float(row["diff2020MinusPurdueM"])
            except (TypeError, ValueError):
                excluded += 1
                continue
            if not (math.isfinite(purdue) and math.isfinite(diff)):
                excluded += 1
                continue
            ids.append(oid)
            values.append(diff)
    if not ids:
        raise ValueError(f"{path}: no rows with both nDHM values present")
    if excluded:
        print(f"note: excluded {excluded} row(s) missing/non-finite values",
              file=sys.stderr)
    return np.asarray(ids, dtype=np.int64), np.asarray(values, dtype=float)


def _ring_centroid(ring) -> tuple[float, float, float]:
    """Area-weighted centroid of one linear ring; returns (x, y, area)."""
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if area2 == 0.0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys), 0.0
    area = area2 / 2.0
    return cx / (6.0 * area), cy / (6.0 * area), abs(area)


def load_footprint_centroids(path: Path) -> dict[int, tuple[float, float]]:
    """Map objectid -> (lon, lat) centroid from a buildings GeoJSON.

    The archived Posey GeoJSON carries no ``crs`` member, so by RFC 7946
    its coordinates are WGS84 longitude/latitude (decimal degrees).
    This is VERIFIED, not assumed: every coordinate must lie in the
    decimal-degree ranges (|lon| <= 180, |lat| <= 90); values that look
    like projected feet/metres raise an error instead of being silently
    treated as degrees. For MultiPolygon features the largest polygon's
    exterior ring is used; the centroid is the area-weighted centroid
    of that ring.
    """
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("type") != "FeatureCollection":
        raise ValueError(f"{path}: expected a GeoJSON FeatureCollection")
    if "crs" in data and data["crs"] is not None:
        raise ValueError(
            f"{path}: unexpected embedded crs member {data['crs']!r}; "
            "this script expects the RFC 7946 default (WGS84 lon/lat) and "
            "refuses to guess at a declared CRS")
    centroids: dict[int, tuple[float, float]] = {}
    for feature in data["features"]:
        props = feature.get("properties") or {}
        oid = props.get("objectid")
        if oid is None:
            continue
        geom = feature.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        if gtype == "Polygon":
            polygons = [coords]
        elif gtype == "MultiPolygon":
            polygons = list(coords)
        else:
            raise ValueError(f"{path}: unsupported geometry type {gtype!r}")
        best: tuple[float, float] | None = None
        best_area = -1.0
        for polygon in polygons:
            if not polygon:
                continue
            cx, cy, area = _ring_centroid(polygon[0])
            if area > best_area:
                best_area = area
                best = (cx, cy)
        if best is None:
            continue
        lon, lat = best
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise ValueError(
                f"{path}: objectid {oid} centroid ({lon}, {lat}) is outside "
                "decimal-degree ranges; coordinates do not look like "
                "WGS84 lon/lat — refusing to compute distances in degrees")
        centroids[int(oid)] = (lon, lat)
    if not centroids:
        raise ValueError(f"{path}: no usable footprint centroids found")
    return centroids


def project_centroids_to_metres(
    centroids: dict[int, tuple[float, float]],
    ids: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Project footprint centroids (lon/lat) to ground metres.

    Route: EPSG:4326 -> EPSG:2966 (NAD83 / Indiana West, ftUS) via
    pyproj, then ftUS -> metres with the exact US survey foot
    (1200/3937 m). Raises if pyproj is unavailable or if the projected
    coordinates fall outside the plausible Indiana West window.
    Returns (x_m, y_m) aligned with ``ids``; raises on any unjoined id.
    """
    try:
        from pyproj import Transformer
    except ImportError as exc:  # pragma: no cover - environment issue
        raise RuntimeError(
            "pyproj is required to project footprint centroids from "
            "EPSG:4326 to EPSG:2966; install it (pip install pyproj) and "
            "re-run") from exc
    missing = [int(oid) for oid in ids if int(oid) not in centroids]
    if missing:
        raise ValueError(
            f"{len(missing)} CSV id(s) have no footprint in the GeoJSON "
            f"(first 10: {missing[:10]}); refusing to invent locations")
    lons = np.array([centroids[int(oid)][0] for oid in ids], dtype=float)
    lats = np.array([centroids[int(oid)][1] for oid in ids], dtype=float)
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:2966",
                                       always_xy=True)
    east_ft, north_ft = transformer.transform(lons, lats)
    east_ft = np.asarray(east_ft, dtype=float)
    north_ft = np.asarray(north_ft, dtype=float)
    if not (np.all((east_ft >= EASTING_FTUS_RANGE[0])
                   & (east_ft <= EASTING_FTUS_RANGE[1]))
            and np.all((north_ft >= NORTHING_FTUS_RANGE[0])
                       & (north_ft <= NORTHING_FTUS_RANGE[1]))):
        raise ValueError(
            "projected EPSG:2966 coordinates fall outside the plausible "
            "Indiana West window for Posey County; check the footprint CRS")
    return east_ft * FTUS_TO_M, north_ft * FTUS_TO_M


# --------------------------------------------------------------------------
# Experimental semivariogram
# --------------------------------------------------------------------------

def experimental_semivariogram(
    x: np.ndarray,
    y: np.ndarray,
    r: np.ndarray,
    n_lags: int = DEFAULT_N_LAGS,
    max_dist: float | None = None,
    min_pairs: int = DEFAULT_MIN_PAIRS,
) -> dict:
    """Matheron experimental semivariogram of ``r`` over lag bins.

    Bins are equal-width over (0, ``max_dist``]; ``max_dist`` defaults
    to 0.5 x the bounding-box diagonal. Pair distances are ground
    metres. Bins with zero pairs report gamma = NaN (never 0) — see the
    module docstring for why. Bins with fewer than ``min_pairs`` pairs
    are flagged unusable (``usable == False``) and must not feed a model
    fit. Pairwise cost is O(n^2); distances are accumulated in chunks
    of rows so memory stays O(n * chunk).
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    r = np.asarray(r, dtype=float)
    n = len(r)
    if not (len(x) == len(y) == n) or n < 2:
        raise ValueError("need at least 2 points with x, y, r aligned")
    if n_lags < 1:
        raise ValueError("n_lags must be >= 1")
    if max_dist is None:
        diag = math.hypot(float(x.max() - x.min()),
                          float(y.max() - y.min()))
        max_dist = 0.5 * diag
    if max_dist <= 0:
        raise ValueError("max_dist must be positive")
    edges = np.linspace(0.0, max_dist, n_lags + 1)
    width = edges[1] - edges[0]
    sumsq = np.zeros(n_lags, dtype=float)
    counts = np.zeros(n_lags, dtype=np.int64)
    chunk = 256
    for i0 in range(0, n, chunk):
        i1 = min(n, i0 + chunk)
        dx = x[i0:i1, None] - x[None, :]
        dy = y[i0:i1, None] - y[None, :]
        dist = np.hypot(dx, dy)
        dz2 = (r[i0:i1, None] - r[None, :]) ** 2
        # Pairs i < j only: mask the diagonal and the lower triangle.
        rows = np.arange(i0, i1)[:, None]
        cols = np.arange(n)[None, :]
        keep = (cols > rows) & (dist > 0.0) & (dist <= max_dist)
        if not np.any(keep):
            continue
        bin_idx = np.minimum((dist[keep] / width).astype(np.int64),
                             n_lags - 1)
        sumsq += np.bincount(bin_idx, weights=dz2[keep],
                             minlength=n_lags)
        counts += np.bincount(bin_idx, minlength=n_lags)
    # THE FIX: zero-pair bins are NaN (unavailable), never 0. A zero
    # semivariance for an unsampled lag would corrupt any model fit.
    with np.errstate(invalid="ignore", divide="ignore"):
        gamma = np.where(counts > 0, 0.5 * sumsq / np.where(counts > 0,
                                                           counts, 1),
                         np.nan)
    centers = 0.5 * (edges[:-1] + edges[1:])
    usable = (counts >= min_pairs) & np.isfinite(gamma)
    return {
        "bin_edges_m": edges,
        "bin_centers_m": centers,
        "gamma_m2": gamma,
        "counts": counts,
        "usable": usable,
        "n_points": n,
        "n_pairs_total": int(counts.sum()),
        "max_dist_m": float(max_dist),
        "bin_width_m": float(width),
        "min_pairs": int(min_pairs),
        "bbox_diagonal_m": float(
            math.hypot(float(x.max() - x.min()),
                       float(y.max() - y.min()))),
    }


# --------------------------------------------------------------------------
# Model fitting
# --------------------------------------------------------------------------

def spherical_model(h, nugget, sill, range_m):
    """Spherical semivariogram model. ``sill`` is the total sill."""
    h = np.asarray(h, dtype=float)
    out = np.full(h.shape, nugget + sill, dtype=float)
    inside = h < range_m
    hr = np.where(inside, h / range_m, 1.0)
    out = np.where(
        inside,
        nugget + sill * (1.5 * hr - 0.5 * hr ** 3),
        out,
    )
    return np.where(h == 0.0, nugget, out)


def exponential_model(h, nugget, sill, range_m):
    """Exponential semivariogram model (range = practical range).

    Parameterised so ``range_m`` is the practical range: the model
    reaches ~95% of the sill at h = range_m, i.e. the exponent uses
    3h/range_m. ``sill`` is the total sill.
    """
    h = np.asarray(h, dtype=float)
    return nugget + sill * (1.0 - np.exp(-3.0 * h / range_m))


MODELS = {
    "spherical": spherical_model,
    "exponential": exponential_model,
}


def fit_model(name, centers, gamma, counts):
    """Fit one model to usable bins; returns params + fit quality.

    Weighted least squares via SciPy ``curve_fit`` (weights =
    sqrt(pair count)). Only bins with finite gamma and counts >= the
    run's min_pairs threshold should be passed in. Fit RMSE and R^2
    are computed against the binned gamma values actually fitted.
    """
    from scipy.optimize import curve_fit

    model = MODELS[name]
    variance = float(np.var(gamma, ddof=1)) if len(gamma) > 1 else 1.0
    top = float(np.nanmax(gamma)) if len(gamma) else 1.0
    span = float(centers.max() - centers.min()) if len(centers) else 1.0
    p0 = [max(0.0, float(np.nanmin(gamma)) * 0.5),
          max(top, 1e-6),
          max(span / 3.0, 1.0)]
    bounds = ([0.0, 0.0, float(centers.min()) if len(centers) else 1.0],
              [max(top * 2.0, 1e-6), max(top * 5.0, 1e-6),
               float(centers.max()) * 3.0 if len(centers) else 1.0])
    sigma = 1.0 / np.sqrt(np.maximum(counts, 1))
    popt, _ = curve_fit(model, centers, gamma, p0=p0, bounds=bounds,
                        sigma=sigma, absolute_sigma=False,
                        maxfev=20000)
    nugget, sill, range_m = (float(v) for v in popt)
    predicted = model(centers, *popt)
    resid = gamma - predicted
    rmse = float(np.sqrt(np.mean(resid ** 2)))
    ss_tot = float(np.sum((gamma - gamma.mean()) ** 2))
    r2 = float(1.0 - np.sum(resid ** 2) / ss_tot) if ss_tot > 0 else float("nan")
    return {
        "model": name,
        "nugget_m2": nugget,
        "sill_m2": sill,  # partial sill; total sill = nugget + sill
        "total_sill_m2": nugget + sill,
        "range_m": range_m,
        "fit_rmse_m2": rmse,
        "fit_r2": r2,
        "n_bins_fitted": int(len(centers)),
        "variance_of_binned_gamma_m2": variance,
    }


def localized_95_bound_m(gamma_at_h_m2: float) -> float:
    """95% bound on the difference of ``r`` between two footprints.

    If ``r`` is known at one footprint, the difference ``r(x+h) - r(x)``
    has variance 2*gamma(h) under the semivariogram definition, so a
    normal 95% bound on that difference is +/-1.96*sqrt(2*gamma(h)).
    This is a bound on *change in inter-product disagreement with
    distance*, not a certified elevation error and not a bound on ``r``
    itself. At large h, gamma -> total sill and the bound saturates at
    1.96*sqrt(2*total_sill).
    """
    return 1.96 * math.sqrt(2.0 * max(gamma_at_h_m2, 0.0))


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------

def run(csv_path: Path, footprints_path: Path, n_lags: int,
        max_dist_m: float | None, min_pairs: int,
        sensitivity_drop_abs_gt: float | None = None) -> dict:
    ids, r = load_disagreement_csv(csv_path)
    centroids = load_footprint_centroids(footprints_path)
    x, y = project_centroids_to_metres(centroids, ids)
    n_both = int(len(r))
    mean = float(np.mean(r))
    std = float(np.std(r, ddof=1))
    rmse = float(np.sqrt(np.mean(r ** 2)))
    result = {
        "dataset": {
            "csv": str(csv_path),
            "footprints": str(footprints_path),
            "residual_definition": (
                "diff2020MinusPurdueM = 2020 nDHM interior-median height "
                "minus Purdue NDHM 2017-2019 height, same footprint, "
                "metres. INTER-PRODUCT DISAGREEMENT between two nDHM "
                "estimates; NOT z_DEM minus z_survey — no survey control "
                "exists in this dataset."),
            "n_points": n_both,
            "n_joined_to_footprints": n_both,
            "footprint_crs_verified": (
                "GeoJSON has no crs member (RFC 7946 default WGS84 "
                "lon/lat); coordinate ranges verified as decimal degrees; "
                "centroids projected EPSG:4326 -> EPSG:2966 (NAD83 / "
                "Indiana West, ftUS) via pyproj, then ftUS -> m with the "
                "exact US survey foot 1200/3937 m."),
            "global_stats_m": {
                "mean": mean,
                "median": float(np.median(r)),
                "std_ddof1": std,
                "rmse_vs_zero": rmse,
                "min": float(np.min(r)),
                "max": float(np.max(r)),
                "agree_within_1m_count": int(np.sum(np.abs(r) <= 1.0)),
            },
            "global_95_from_std_m": 1.96 * std,
            "nssda_95_dynamic_m": NSSDA_95_M,
            "nssda_95_seamless_m": NSSDA_SEAMLESS_95_M,
        },
    }
    sv = experimental_semivariogram(x, y, r, n_lags=n_lags,
                                    max_dist=max_dist_m,
                                    min_pairs=min_pairs)
    result["semivariogram"] = {
        "bin_centers_m": [float(v) for v in sv["bin_centers_m"]],
        "bin_edges_m": [float(v) for v in sv["bin_edges_m"]],
        "gamma_m2": [None if not math.isfinite(v) else float(v)
                     for v in sv["gamma_m2"]],
        "counts": [int(v) for v in sv["counts"]],
        "usable": [bool(v) for v in sv["usable"]],
        "n_points": sv["n_points"],
        "n_pairs_total": sv["n_pairs_total"],
        "max_dist_m": sv["max_dist_m"],
        "bin_width_m": sv["bin_width_m"],
        "min_pairs": sv["min_pairs"],
        "bbox_diagonal_m": sv["bbox_diagonal_m"],
        "n_usable_bins": int(np.sum(sv["usable"])),
        "n_unusable_bins": int(np.sum(~sv["usable"])),
    }
    fit_centers = sv["bin_centers_m"][sv["usable"]]
    fit_gamma = sv["gamma_m2"][sv["usable"]]
    fit_counts = sv["counts"][sv["usable"]]
    fits = {}
    for name in ("spherical", "exponential"):
        fits[name] = fit_model(name, fit_centers, fit_gamma, fit_counts)
    # Selection criterion, stated: smaller fit RMSE against the binned
    # gamma values on the usable bins.
    better = min(fits, key=lambda k: fits[k]["fit_rmse_m2"])
    result["model_fits"] = fits
    result["selected_model"] = {
        "model": better,
        "criterion": ("smaller fit RMSE against binned gamma on usable "
                      "bins (counts >= min_pairs)"),
        "fit_rmse_m2": fits[better]["fit_rmse_m2"],
        "other_model_fit_rmse_m2": fits[
            "exponential" if better == "spherical" else "spherical"
        ]["fit_rmse_m2"],
    }
    best = fits[better]
    model_fn = MODELS[better]
    lags_of_interest_m = [500.0, 2000.0, 5000.0, 10000.0,
                          float(best["range_m"])]
    comparison = []
    for h in lags_of_interest_m:
        g = float(model_fn(np.array([h]), best["nugget_m2"],
                           best["sill_m2"], best["range_m"])[0])
        comparison.append({
            "lag_m": h,
            "model_gamma_m2": g,
            "localized_95_difference_bound_m":
                localized_95_bound_m(g),
        })
    comparison.append({
        "lag_m": None,
        "note": "asymptotic (h >> range): gamma -> total sill",
        "model_gamma_m2": best["total_sill_m2"],
        "localized_95_difference_bound_m":
            localized_95_bound_m(best["total_sill_m2"]),
    })
    result["comparison_vs_global_shortcut"] = {
        "global_1.96_x_std_of_r_m": 1.96 * std,
        "nssda_95_dynamic_1.96_x_0.53m_rmse_m": NSSDA_95_M,
        "localized_bounds_from_selected_model": comparison,
        "interpretation": (
            "The localized bound is +/-1.96*sqrt(2*gamma(h)) on the "
            "CHANGE in inter-product disagreement between two footprints "
            "h apart, given the disagreement at one of them. It is not a "
            "certified elevation error and not a bound on r itself. Where "
            "gamma(h) is below the total sill, nearby footprints disagree "
            "more consistently than the global spread suggests; where "
            "bins are unusable (counts < min_pairs) the data are too "
            "sparse to support localization at that lag."),
    }
    result["scope"] = (
        "ENGINEERING validation for TSM constraints only. NOT a FEMA or "
        "survey certification. NOT LOMA evidence. LOMA 26-05-2022A is NOT "
        "ISSUED (FEMA additional-information request 2026-09-22; 90-day "
        "track ends 2026-12-21). Regulatory BFE 369.1 ft NAVD88.")
    if sensitivity_drop_abs_gt is not None:
        keep = np.abs(r) <= sensitivity_drop_abs_gt
        sub = _analyse_subset(x[keep], y[keep], r[keep], n_lags,
                              max_dist_m, min_pairs)
        sub["dropped_points"] = int(np.sum(~keep))
        sub["kept_points"] = int(np.sum(keep))
        sub["drop_threshold_m"] = float(sensitivity_drop_abs_gt)
        sub["note"] = (
            "Sensitivity check only: the primary analysis above uses all "
            "points. The Matheron estimator squares differences, so a few "
            "large disagreements dominate gamma; this subset shows how "
            "much of the signal they carry. It is not a replacement "
            "analysis and no points are discarded from the primary run.")
        result["sensitivity_drop_large_disagreements"] = sub
    return result


def _analyse_subset(x, y, r, n_lags, max_dist_m, min_pairs) -> dict:
    """Semivariogram + both model fits for one point subset."""
    sv = experimental_semivariogram(x, y, r, n_lags=n_lags,
                                    max_dist=max_dist_m,
                                    min_pairs=min_pairs)
    fit_centers = sv["bin_centers_m"][sv["usable"]]
    fit_gamma = sv["gamma_m2"][sv["usable"]]
    fit_counts = sv["counts"][sv["usable"]]
    fits = {name: fit_model(name, fit_centers, fit_gamma, fit_counts)
            for name in ("spherical", "exponential")}
    better = min(fits, key=lambda k: fits[k]["fit_rmse_m2"])
    return {
        "variance_of_r_m2": float(np.var(r, ddof=1)),
        "std_of_r_m": float(np.std(r, ddof=1)),
        "bin_centers_m": [float(v) for v in sv["bin_centers_m"]],
        "gamma_m2": [None if not math.isfinite(v) else float(v)
                     for v in sv["gamma_m2"]],
        "counts": [int(v) for v in sv["counts"]],
        "usable": [bool(v) for v in sv["usable"]],
        "model_fits": fits,
        "selected_model": better,
        "selection_criterion": ("smaller fit RMSE against binned gamma "
                                "on usable bins"),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Semivariogram of inter-product nDHM disagreement "
                    "(NOT survey residuals; NOT LOMA evidence).")
    parser.add_argument("--csv", required=True,
                        help="nDHM probe per-ID CSV "
                             "(diff2020MinusPurdueM column)")
    parser.add_argument("--footprints", required=True,
                        help="Posey buildings GeoJSON (WGS84 lon/lat, "
                             "objectid property)")
    parser.add_argument("--out", default=None,
                        help="JSON output path (default: print to stdout)")
    parser.add_argument("--n-lags", type=int, default=DEFAULT_N_LAGS)
    parser.add_argument("--max-dist-m", type=float, default=None,
                        help="default 0.5 x bounding-box diagonal")
    parser.add_argument("--min-pairs", type=int, default=DEFAULT_MIN_PAIRS)
    parser.add_argument("--sensitivity-drop-abs-gt", type=float, default=None,
                        help="optional sensitivity re-run dropping points "
                             "with |r| above this threshold (metres); the "
                             "primary analysis always uses all points")
    args = parser.parse_args(argv)
    result = run(Path(args.csv), Path(args.footprints), args.n_lags,
                 args.max_dist_m, args.min_pairs,
                 args.sensitivity_drop_abs_gt)
    text = json.dumps(result, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)
    ds = result["dataset"]
    sv = result["semivariogram"]
    sel = result["selected_model"]
    best = result["model_fits"][sel["model"]]
    print(f"points: {ds['n_points']}  pairs: {sv['n_pairs_total']}  "
          f"usable bins: {sv['n_usable_bins']}/{len(sv['counts'])}",
          file=sys.stderr)
    print(f"global r: mean {ds['global_stats_m']['mean']:.4f} m, "
          f"std {ds['global_stats_m']['std_ddof1']:.4f} m, "
          f"RMSE {ds['global_stats_m']['rmse_vs_zero']:.4f} m, "
          f"1.96*std {ds['global_95_from_std_m']:.4f} m; "
          f"NSSDA 95% dynamic +/-{ds['nssda_95_dynamic_m']:.4f} m",
          file=sys.stderr)
    print(f"selected model: {sel['model']} (criterion: {sel['criterion']}; "
          f"fit RMSE {sel['fit_rmse_m2']:.6f} m^2 vs "
          f"{sel['other_model_fit_rmse_m2']:.6f} m^2)  "
          f"nugget {best['nugget_m2']:.6f} m^2, sill "
          f"{best['sill_m2']:.6f} m^2 (total "
          f"{best['total_sill_m2']:.6f} m^2), range "
          f"{best['range_m']:.1f} m, R^2 {best['fit_r2']:.4f}",
          file=sys.stderr)
    sub = result.get("sensitivity_drop_large_disagreements")
    if sub:
        sbest = sub["model_fits"][sub["selected_model"]]
        print(f"sensitivity (|r| <= {sub['drop_threshold_m']:.0f} m, "
              f"n={sub['kept_points']}, dropped {sub['dropped_points']}): "
              f"std {sub['std_of_r_m']:.4f} m, selected "
              f"{sub['selected_model']} range {sbest['range_m']:.1f} m, "
              f"R^2 {sbest['fit_r2']:.4f}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
