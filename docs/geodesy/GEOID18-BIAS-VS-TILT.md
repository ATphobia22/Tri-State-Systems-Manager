# GEOID18 bias vs tilt — detailed explanation (NGS hybrid construction)

## 1. Why hybrid geoids exist

A **gravimetric geoid** (e.g. xGEOID19B) is built from gravity data: surface gravity, airborne GRAV-D, satellite models (GRACE/GOCE), and terrain reductions. It approximates an equipotential surface of Earth’s gravity field.

**NAVD88** is *not* that surface. It is a leveling-based orthometric height system constrained to a historical network of bench marks. Relative to modern global geoids, NAVD88 has known **systematic error**: roughly **~0.5 m bias** and **~1 m coast-to-coast tilt**.

Surveyors and FEMA still need heights that match **published NAVD88 bench marks**. NGS therefore builds a **hybrid** model (GEOID18): start from a gravimetric geoid, then warp it so GPS-derived orthometric heights agree with leveled NAVD88 at GPS-on-bench-marks (GPSonBM).

## 2. Residual at each bench mark

At each GPSonBM station used in GEOID18:

\[
r = h_{\mathrm{NAD83(2011)}} - H_{\mathrm{NAVD88}} - N_{\mathrm{xGEOID19B}}
\]

- \(h\): GNSS ellipsoid height in NAD83(2011) epoch 2010.0
- \(H\): leveled orthometric height on NAVD88
- \(N_{\mathrm{xGEOID}}\): gravimetric geoid height

If NAVD88 matched the gravimetric geoid perfectly, residuals would be noise. They do not: they show continent-scale structure plus local warps.

## 3. Bias (constant offset)

**Bias** is the near-constant component of \(r\) over the modeling region (CONUS).

- Physically: NAVD88’s zero surface is offset from the modern geoid by on the order of **half a meter** (NGS new-datums materials).
- In hybrid construction: NGS estimates a mean offset and **removes** it so residuals are approximately zero-mean before local modeling.
- Effect on users: GEOID18 absorbs that offset into \(N\), so \(H = h - N_{\mathrm{GEOID18}}\) tracks **NAVD88**, not pure mean sea level or a pure geoid.

Bias is **not** the ±1.27 cm fit figure. Bias is a large-scale datum offset that the hybrid deliberately captures.

## 4. Tilt (planar slope)

**Tilt** is a slowly varying planar gradient of residuals across CONUS (east–west and north–south).

- Physically: NAVD88 is **tilted about ~1 meter coast-to-coast** relative to modern global geoids (NGS). Leveling networks accumulate systematic error over continental distances.
- In hybrid construction: NGS fits a **2-D plane** to residuals after bias removal and subtracts that plane.
- Effect on users: GEOID18 follows NAVD88’s long-wavelength slope. Heights converted with GEOID18 stay consistent with the NAVD88 *network*, including its tilt relative to a pure geoid.

Without tilt removal, a single constant \(N\) correction would systematically drift across the country.

## 5. After bias + tilt: local warps

Remaining residuals are modeled with **least-squares collocation** (multiple Gaussian covariance functions) to produce a 1-arc-minute conversion surface. That surface is added to the gravimetric geoid to form hybrid GEOID18:

\[
N_{\mathrm{GEOID18}} = N_{\mathrm{xGEOID19B}} + \underbrace{\text{bias + tilt + local warp}}_{\text{conversion surface}}
\]

GPSonBM fit of the final hybrid is about **±1.27 cm (1σ) CONUS** — how well the surface matches the marks used to build it. It is **not**:

- absolute accuracy of NAVD88 itself,
- uncertainty of your GNSS \(h\),
- a substitute for differential leveling between published marks.

Uncertainty grids rise with distance from controlling bench marks. Dense areas can look optimistic; sparse areas pessimistic.

## 6. What GEOID18 is *for*

| Intended use | Not intended use |
|---|---|
| Convert NAD83(2011) \(h\) → NAVD88-consistent \(H\) | Convert WGS84/ITRF \(h\) without HTDP/NCAT first |
| Engineering / mapping consistency with NAVD88 products | Certified LOMA without survey evidence |
| FEMA-aligned orthometric work in CONUS | Pure geopotential / “true” geoid height |

Equation for users:

\[
H_{\mathrm{NAVD88}} = h_{\mathrm{NAD83(2011)}} - N_{\mathrm{GEOID18}}
\]

## 7. NAPGD2022 / GEOID2022 (watch only)

The modernized NSRS replaces hybrid NAVD88 tying with a **gravimetric geopotential datum** (NAPGD2022 / GEOID2022). Bias and tilt relative to the old network will appear as **datum shifts** when Indiana practice migrates. Until then, TSM analysis remains **EPSG:2966 + NAVD88** with GEOID18 as the ellipsoid→orthometric chain step.

## 8. TSM policy summary

1. Site BFE / LAG / FFE stay labeled **NAVD88 orthometric** (or explicit uncertified owner values).
2. GNSS → NAVD88 only via **GEOID18** (after NAD83(2011)).
3. Report converted heights as **model-derived orthometric**, not leveled.
4. Terrain-RGB and 3DEP tiles are **visualization DERIVED**, not survey \(H\).
5. Gage stage stays **GAGE_DATUM** until a published station conversion is validated.
6. Fail-closed: do not invent \(N\), gage-zero, or WSE.

## References (NGS)

- GEOID18 Technical Details (NGS)
- NOAA TR NOS NGS 72 — GEOID18
- NGS New Datums / NAPGD2022 materials (bias ~0.5 m, tilt ~1 m coast-to-coast relative to modern global geoids)
