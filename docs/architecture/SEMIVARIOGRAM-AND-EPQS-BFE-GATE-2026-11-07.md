# Semivariogram module + EPQS×BFE UI gate

**Date:** 2026-11-07  
**Authority:** DERIVED products only. Human / PE / FEMA remain final for LOMA.

## Implemented

| Piece | Path |
|-------|------|
| Empirical γ(h) + metric CRS guard + grid fit | `packages/geodesy/src/semivariogram.ts` |
| Optional SciPy fit CLI | `packages/geodesy/python/fit_semivariogram.py` |
| MapLibre-side warning modal | `tsm-console/src/components/EpqsBfeWarningModal.tsx` |
| PostGIS residuals / uncertainty tables | `db/migrations/122_elevation_residuals_uncertainty.sql` |

## Rules

1. Coordinates for `hypot` must be **metres** (e.g. EPSG:2966), not degrees.  
2. `N(h) ≥ 30` required for a sufficient lag bin.  
3. `authority_class = DERIVED` on all residual and uncertainty rows.  
4. UI must call `shouldBlockEpqsBfeEligibilityCompare` before any EPQS−BFE eligibility path.  
5. NSSDA `1.96 × RMSE` is dataset reporting only (~1.04 m for 0.53 m RMSE), not a certified lot corner.
