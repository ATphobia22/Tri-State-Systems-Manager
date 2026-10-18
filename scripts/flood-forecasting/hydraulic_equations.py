#!/usr/bin/env python3
"""
TSM hydraulic equation solver using SymPy for exact symbolic computation.

Open-channel hydraulic equations with exact symbolic evaluation — no
floating-point rounding where exactness is achievable.

Units: English (feet, cfs) unless otherwise stated.

Equations implemented:
  - Manning's equation (English units)
  - Stage-discharge rating curve (power-law fit)
  - Exact unit conversions (feet/meters, cfs/cms, NGVD29/NAVD88)
  - Normal depth in a trapezoidal channel (solved symbolically)

Datum note: the NGVD29 <-> NAVD88 offset used here (0.213 m) is the
documented working approximation for the Ohio-Wabash confluence area
(see tsm-console/src/lib/canvas-flood-layer.ts). It is NOT a certified
conversion for regulatory use.
"""

from __future__ import annotations

import sympy as sp

# ---------------------------------------------------------------------------
# Symbolic variables (shared)
# ---------------------------------------------------------------------------

Q, n, A, R, S = sp.symbols("Q n A R S", positive=True)   # Manning vars
h, h0, a, b = sp.symbols("h h0 a b", real=True)          # rating curve vars
y, B, z = sp.symbols("y B z", positive=True)             # channel vars

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: English-unit Manning's coefficient (1.486 ft^1/3 / s)
MANNING_K_ENGLISH = sp.Rational(1486, 1000)

#: Feet per meter (exact definition: 1 ft = 0.3048 m exactly)
FT_PER_M = sp.Rational(3048, 10000)

#: Documented NGVD29 -> NAVD88 offset for the confluence area (meters).
#: NGVD29 elevations run ~0.213 m higher; subtract to go NGVD29 -> NAVD88.
NGVD29_TO_NAVD88_M = sp.Rational(213, 1000)

# ---------------------------------------------------------------------------
# Manning's equation
# ---------------------------------------------------------------------------

#: Q = (K/n) * A * R**(2/3) * S**(1/2), English units
MANNING_EQ = sp.Eq(Q, (MANNING_K_ENGLISH / n) * A * R ** sp.Rational(2, 3)
                   * sp.sqrt(S))


def solve_manning(**kwargs) -> sp.Expr:
    """Solve Manning's equation for exactly one unknown variable.

    Manning's (English): Q = (1.486/n) * A * R^(2/3) * S^(1/2)

    Parameters
    ----------
    kwargs : mapping
        Provide exactly four of: Q, n, A, R, S (numeric or SymPy exprs).
        The one omitted is solved for.

    Returns
    -------
    sympy.Expr
        The exact symbolic expression for the unknown.

    Examples
    --------
    >>> solve_manning(n=0.035, A=10000, R=8, S=0.0005)  # discharge
    >>> solve_manning(Q=50000, A=10000, R=8, S=0.0005)  # roughness
    """
    names = {"Q": Q, "n": n, "A": A, "R": R, "S": S}
    unknown = [k for k in names if k not in kwargs]
    if len(unknown) != 1:
        raise ValueError(
            f"Provide exactly 4 of Q, n, A, R, S; got {sorted(kwargs)}")
    target = names[unknown[0]]
    subs = {names[k]: sp.sympify(v) for k, v in kwargs.items()}
    eq = MANNING_EQ.subs(subs)
    sol = sp.solve(eq, target, dict=True)
    if not sol:
        raise ValueError(f"No solution for {unknown[0]} with given inputs.")
    return sp.simplify(sol[0][target])


# ---------------------------------------------------------------------------
# Stage-discharge rating curve
# ---------------------------------------------------------------------------

#: Q = a * (h - h0)**b
RATING_EQ = sp.Eq(Q, a * (h - h0) ** b)


def fit_rating_curve(stages, discharges):
    """Fit a power-law rating curve Q = a * (h - h0)**b to observations.

    Uses a log-log linear regression so the fit is exact in the
    transformed space. h0 (stage of zero flow) is estimated from the
    two lowest observations by linear extrapolation to Q = 0 when
    stages are distinct; otherwise h0 = min(stage).

    Parameters
    ----------
    stages : sequence of float
        Observed gage heights (ft).
    discharges : sequence of float
        Observed discharges (cfs), same length as stages.

    Returns
    -------
    dict
        {"a": float, "b": float, "h0": float, "r_squared": float}
        plus symbolic form "symbolic": Q = a*(h-h0)**b as a SymPy Eq.
    """
    hs = [float(v) for v in stages]
    qs = [float(v) for v in discharges]
    if len(hs) != len(qs) or len(hs) < 3:
        raise ValueError("Need at least 3 stage/discharge pairs.")
    if any(v <= 0 for v in qs):
        raise ValueError("Discharges must be positive for log fit.")

    # Estimate h0 from the two lowest points
    pairs = sorted(zip(hs, qs), key=lambda p: p[1])
    (h1, q1), (h2, q2) = pairs[0], pairs[1]
    h0_est = h1 - q1 * (h2 - h1) / (q2 - q1) if q2 != q1 else min(hs)

    import math
    xs = [math.log(h - h0_est) for h in hs]
    ys = [math.log(q) for q in qs]
    xm = sum(xs) / len(xs)
    ym = sum(ys) / len(ys)
    sxx = sum((x - xm) ** 2 for x in xs)
    if sxx == 0:
        raise ValueError("Stages are not distinct enough for a fit.")
    b_fit = sum((x - xm) * (y - ym) for x, y in zip(xs, ys)) / sxx
    ln_a = ym - b_fit * xm
    a_fit = math.exp(ln_a)

    # R^2 in log space
    ss_tot = sum((y - ym) ** 2 for y in ys)
    ss_res = sum((y - (ln_a + b_fit * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0

    symbolic = sp.Eq(Q, a_fit * (h - h0_est) ** b_fit)
    return {"a": a_fit, "b": b_fit, "h0": h0_est,
            "r_squared": r2, "symbolic": symbolic}


def rating_curve_discharge(stage, a, b, h0):
    """Evaluate Q = a * (stage - h0)**b.

    Returns None when stage <= h0 (no flow / below zero-flow stage).
    """
    stage, a, b, h0 = (float(stage), float(a), float(b), float(h0))
    if stage <= h0:
        return None
    return a * (stage - h0) ** b


# ---------------------------------------------------------------------------
# Exact unit conversions (SymPy rational arithmetic)
# ---------------------------------------------------------------------------

def feet_to_meters(ft) -> sp.Expr:
    """Convert feet to meters (exact: 1 ft = 0.3048 m)."""
    return sp.sympify(ft) * FT_PER_M


def meters_to_feet(m) -> sp.Expr:
    """Convert meters to feet (exact rational division)."""
    return sp.sympify(m) / FT_PER_M


def cfs_to_cms(cfs) -> sp.Expr:
    """Convert cubic feet/second to cubic meters/second (exact)."""
    return sp.sympify(cfs) * FT_PER_M ** 3


def cms_to_cfs(cms) -> sp.Expr:
    """Convert cubic meters/second to cubic feet/second (exact)."""
    return sp.sympify(cms) / FT_PER_M ** 3


def ngvd29_to_navd88_m(elev_m) -> sp.Expr:
    """Convert elevation NGVD29 -> NAVD88 (meters).

    Uses the documented working offset (0.213 m) for the Ohio-Wabash
    confluence area. NOT certified for regulatory use.
    """
    return sp.sympify(elev_m) - NGVD29_TO_NAVD88_M


def navd88_to_ngvd29_m(elev_m) -> sp.Expr:
    """Convert elevation NAVD88 -> NGVD29 (meters). See caveat above."""
    return sp.sympify(elev_m) + NGVD29_TO_NAVD88_M


# ---------------------------------------------------------------------------
# Normal depth in a trapezoidal channel
# ---------------------------------------------------------------------------

def normal_depth(discharge_cfs, roughness, slope, bottom_width_ft,
                 side_slope_z, initial_guess_ft=5.0):
    """Solve Manning's equation for normal depth in a trapezoidal channel.

    Geometry: A = (B + z*y) * y ; P = B + 2*y*sqrt(1 + z**2) ; R = A / P.

    Parameters
    ----------
    discharge_cfs : float
        Design discharge (cfs).
    roughness : float
        Manning's n.
    slope : float
        Channel slope (ft/ft).
    bottom_width_ft : float
        Trapezoid bottom width B (ft).
    side_slope_z : float
        Side slope z (horizontal:vertical).
    initial_guess_ft : float
        Starting point for the numeric root solve.

    Returns
    -------
    dict
        {"depth_ft": float, "area_ft2": float, "wetted_perimeter_ft": float,
         "hydraulic_radius_ft": float, "velocity_fps": float}
    """
    Qv = float(discharge_cfs)
    nv = float(roughness)
    Sv = float(slope)
    Bv = float(bottom_width_ft)
    zv = float(side_slope_z)
    if min(Qv, nv, Sv, Bv) <= 0 or zv < 0:
        raise ValueError("Q, n, S, B must be positive; z must be >= 0.")

    # Symbolic residual: Manning Q(y) - Q_target = 0
    A_expr = (B + z * y) * y
    P_expr = B + 2 * y * sp.sqrt(1 + z ** 2)
    R_expr = A_expr / P_expr
    Q_expr = (MANNING_K_ENGLISH / n) * A_expr * R_expr ** sp.Rational(2, 3) \
        * sp.sqrt(S)
    residual = Q_expr.subs({Q: Qv, n: nv, S: Sv, B: Bv, z: zv}) - Qv

    sol = sp.nsolve(residual, y, initial_guess_ft, tol=1e-14, maxsteps=200)
    depth = float(sol)
    if depth <= 0:
        raise ValueError("Non-physical (non-positive) depth solution.")
    area = float(((Bv + zv * depth) * depth))
    perim = float(Bv + 2 * depth * sp.sqrt(1 + zv ** 2))
    hydr = area / perim
    vel = Qv / area
    return {"depth_ft": depth, "area_ft2": area,
            "wetted_perimeter_ft": perim,
            "hydraulic_radius_ft": hydr, "velocity_fps": vel}


# ---------------------------------------------------------------------------
# Demo with TSM gage values
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== TSM SymPy hydraulic equations demo ===\n")

    # 1. Manning's: discharge for a reach of the Ohio River near
    #    Old Shawneetown (USGS 03381700), approximate main-channel values
    q = solve_manning(n=0.030, A=18000, R=12, S=0.0002)
    print(f"1. Manning's Q (n=0.030, A=18000 ft^2, R=12 ft, S=0.0002):")
    print(f"   Q = {q} cfs  (~{float(q):,.0f} cfs)")

    # Solve the inverse: what roughness gives Q = 150,000 cfs?
    n_sol = solve_manning(Q=150000, A=18000, R=12, S=0.0002)
    print(f"   Inverse: n for Q=150,000 cfs = {n_sol} (~{float(n_sol):.4f})\n")

    # 2. Rating curve fit from synthetic-but-plausible calibration points
    stages = [10.0, 20.0, 30.0, 40.0]
    dischs = [25000.0, 70000.0, 140000.0, 230000.0]
    fit = fit_rating_curve(stages, dischs)
    print("2. Rating curve fit Q = a*(h-h0)^b:")
    print(f"   a={fit['a']:.4f}, b={fit['b']:.4f}, h0={fit['h0']:.3f} ft, "
          f"R^2={fit['r_squared']:.6f}")
    print(f"   Q at 33 ft (Shawneetown flood stage): "
          f"{rating_curve_discharge(33, fit['a'], fit['b'], fit['h0']):,.0f} cfs\n")

    # 3. Exact unit conversions
    print("3. Exact conversions (SymPy rational):")
    print(f"   33.0 ft = {feet_to_meters(33)} m")
    print(f"   100000 cfs = {cfs_to_cms(100000)} cms")
    # 03378500 datum 353.07 ft NGVD29 -> NAVD88
    datum_ngvd29_ft = sp.Rational(35307, 100)
    datum_m = feet_to_meters(datum_ngvd29_ft)
    datum_navd88_m = ngvd29_to_navd88_m(datum_m)
    print(f"   03378500 datum 353.07 ft NGVD29 = {datum_navd88_m} m NAVD88 "
          f"(~{float(meters_to_feet(datum_navd88_m)):.2f} ft)\n")

    # 4. Normal depth: Wabash River near New Harmony, trapezoidal approx.
    nd = normal_depth(discharge_cfs=60000, roughness=0.032, slope=0.0003,
                      bottom_width_ft=400, side_slope_z=2.0)
    print("4. Normal depth (Q=60000 cfs, n=0.032, S=0.0003, B=400 ft, z=2):")
    for k, v in nd.items():
        print(f"   {k}: {v:.3f}")
