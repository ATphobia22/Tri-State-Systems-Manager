# Geodetic ECEF Validation Report — Posey County, Indiana

**Date:** 2026-11-11  
**Anchor:** 13101 Bonebank Rd / Point Twp / Posey Co (~37.84589°N, 88.00510°W)  
**Policy:** Technology informs; human authority remains final.

## Purpose

Records WGS84 ECEF conversion, corrected Posey bounds, the Midwest negative-X sign trap, and CI results. Certifies the **harness**, not final production HLOD.

## Geodetic → ECEF

- \(a = 6378137\) m, \(f = 1/298.257223563\), \(e^2 \approx 0.00669437999014\)
- \(N(\phi) = a / \sqrt{1 - e^2\sin^2\phi}\)
- \(X=(N+h)\cos\phi\cos\lambda\), \(Y=(N+h)\cos\phi\sin\lambda\), \(Z=(N(1-e^2)+h)\sin\phi\)
- Do not label ellipsoidal \(h\) as NAVD88 without GEOID18/VDatum metadata.

## Midwest sign trap

At ~88°W, \(\cos\lambda > 0\) (small) and \(\sin\lambda < 0\) (large). Therefore **X > 0**, **Y ≪ 0**, **Z > 0**. Negative X is not “Western Hemisphere” in ECEF at this longitude — that role is played mainly by negative Y. CI: `test_rejects_negative_x_sign_trap`.

## Corrected bounds

| Axis | Min (m) | Max (m) | Bonebank ref (m) |
|------|---------|---------|------------------|
| X | 150000 | 210000 | 175550.80 |
| Y | −5060000 | −5000000 | −5039980.70 |
| Z | 3870000 | 3940000 | 3892024.20 |

Closed-form Bonebank (h=120 m): X≈175550.84, Y≈−5039980.67, Z≈3892024.17 — **inside** envelope; Δ to staged reference &lt; 4 cm.

## CI results (2026-11-11)

`tests/geospatial/test_posey_ecef_bounds.py` — **4 passed**:

1. Bonebank anchor accepted  
2. Negative X rejected  
3. Origin displacement rejected  
4. Staged `tileset.json` integration accepted  

## Limitations

Spatial CI ≠ production HLOD. DERIVED_STAGING until real 3DEP/topobathy, null-safe buildings, and HEC read-only layers land. Milestone B still needs air-gapped Win11 Shipping execution.

Human authority remains final.
