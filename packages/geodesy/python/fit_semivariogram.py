"""
Optional SciPy curve fit for empirical semivariogram bins.
Authority: DERIVED only — never certifies LAG/LOMA elevations.

Usage:
  python fit_semivariogram.py --csv residuals.csv
  CSV columns: lag_center_m, gamma, pair_count
"""
from __future__ import annotations

import argparse
import csv
from typing import Sequence

try:
    import numpy as np
    from scipy.optimize import curve_fit
except ImportError as e:
    raise SystemExit("Requires numpy and scipy: pip install numpy scipy") from e


def spherical(h, nugget, sill, range_m):
    h = np.asarray(h, dtype=float)
    out = np.empty_like(h)
    for i, hi in enumerate(h):
        if hi <= 0:
            out[i] = nugget
        elif hi >= range_m:
            out[i] = nugget + sill
        else:
            a = hi / range_m
            out[i] = nugget + sill * (1.5 * a - 0.5 * a**3)
    return out


def exponential(h, nugget, sill, range_m):
    h = np.asarray(h, dtype=float)
    return nugget + sill * (1.0 - np.exp(-3.0 * h / max(range_m, 1e-9)))


def fit(lags: Sequence[float], gamma: Sequence[float], model: str = "spherical"):
    lags_a = np.asarray(lags, dtype=float)
    gamma_a = np.asarray(gamma, dtype=float)
    if model not in ('spherical', 'exponential'):
        raise ValueError('Unsupported model')
    mask = np.isfinite(gamma_a) & np.isfinite(lags_a) & (lags_a > 0) & (gamma_a >= 0)
    lags_a, gamma_a = lags_a[mask], gamma_a[mask]
    if lags_a.size < 3:
        raise ValueError("Need at least 3 finite bins")

    nugget0 = float(np.min(gamma_a))
    sill0 = float(max(np.max(gamma_a) - nugget0, 1e-6))
    range0 = float(np.median(lags_a))
    fn = spherical if model == "spherical" else exponential
    popt, _ = curve_fit(
        fn,
        lags_a,
        gamma_a,
        p0=(max(nugget0, 0.0), sill0, range0),
        bounds=([0, 0, 1e-3], [np.inf, np.inf, np.inf]),
        maxfev=5000,
    )
    nugget, sill, range_m = (float(x) for x in popt)
    pred = fn(lags_a, nugget, sill, range_m)
    rmse = float(np.sqrt(np.mean((gamma_a - pred) ** 2)))
    return {
        "model": model,
        "nugget": nugget,
        "sill": sill,
        "range_m": range_m,
        "rmse_fit": rmse,
        "authorityClass": "DERIVED",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--model", choices=["spherical", "exponential"], default="spherical")
    args = ap.parse_args()
    lags, gammas = [], []
    with open(args.csv, newline="") as f:
        for row in csv.DictReader(f):
            if int(float(row.get("pair_count", 0))) < 30:
                continue
            lags.append(float(row["lag_center_m"]))
            gammas.append(float(row["gamma"]))
    print(fit(lags, gammas, args.model))


if __name__ == "__main__":
    main()
