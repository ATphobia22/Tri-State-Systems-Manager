# BFE Correction Record — 2026-10-18

## Change

**Previous:** BFE 375.0 ft NAVD88 (working target from Bonebank_LOMA_Checklist.pdf, 2026-08-22)
**Corrected:** BFE **369.1 ft NAVD88** (regulatory, from FEMA FIS)

## Evidence (three independent sources agree)

1. **FEMA FIS 18129CV000A, Table 9** (effective 2014-11-05)
   - Section A, RM 844.75 (0.46 mi from anchor site)
   - Regulatory BFE: **369.1 ft NAVD88**
   - Downloaded from https://msc.fema.gov/portal/downloadProduct?productTypeID=FINAL_PRODUCT&productSubTypeID=FIS_REPORT&productID=18129CV000A

2. **Indiana DNR FLOOD_XS_EFFECTIVE_DNR.csv**
   - 908 cross-sections, Posey County DFIRM 18129C
   - Section A: wsel_reg = **369.1 ft NAVD88**
   - Matches FIS Table 9 exactly

3. **FEMA FIRMette** (msc.fema.gov, user screenshot 2026-10-18)
   - Anchor site (37.845896, -88.005106) in Zone AE
   - BFE contour lines labeled **369** and **369.1** at the site

## Impact

| Metric | Before (375.0) | After (369.1) | Change |
|--------|---------------|---------------|--------|
| BFE | 375.0 ft | 369.1 ft | -5.9 ft |
| LAG 377.2 ft above BFE | +2.2 ft | **+8.1 ft** | +5.9 ft |
| INFIP 368.7 vs BFE gap | 6.3 ft | **0.4 ft** | -5.9 ft |

## LOMA Case 26-05-2022A Implications

The INFIP baseline (368.7 ft) is now only 0.4 ft below the regulatory BFE (369.1 ft), not 6.3 ft below. This significantly narrows the reconciliation gap.

## Files Updated

- `scripts/flood-forecasting/bfe_ingestion.py`: WORKING_BFE_FT_NAVD88 375.0 → 369.1, added REGULATORY_BFE_FT_NAVD88
- This correction record

## Files Requiring Future Update

The following files still reference 375.0 ft and should be updated in a follow-up pass:
- `scripts/geospatial/derive-building-models.py`
- `scripts/geospatial/tsm_temporal_4d_engine.py`
- `scripts/geospatial/export_gocad_4d.py`
- `scripts/verify-backend-invariants.py`
- Various docs in `docs/`, `data/designs/`, `data/scenarios/`

## Authority

This correction is based on the effective FEMA Flood Insurance Study, which is the regulatory authority for Base Flood Elevations. The previous 375.0 ft value was a working target from an informational checklist, not a regulatory determination.
