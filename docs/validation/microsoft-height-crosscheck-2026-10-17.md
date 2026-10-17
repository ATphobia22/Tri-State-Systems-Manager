# Microsoft Building Height Cross-Validation — 2026-10-17

## Method
- Source: Microsoft Global ML Building Footprints, 2026 refresh (1.4B buildings)
- Quadkey 032000212 (Posey County, IN): 42,965 buildings, 24,583 with ML-derived heights
- Sample: 1,000 random buildings from TSM `buildings-3d.json`
- Match: nearest Microsoft centroid within ~20m

## Results
- Matched: 240/1000 (24%)
- Mean absolute height difference: 1.47 m
- Median absolute height difference: 0.92 m
- Within 2 m: 79.6%

## Interpretation
TSM's LiDAR/NDHM-derived heights agree with Microsoft's independent
neural-network height estimates to within ~1 m median. This is strong
external validation that the TSM height pipeline produces physically
plausible results.

The 24% match rate reflects: (1) quadkey larger than Posey County,
(2) different building detection (Microsoft ML vs IGIO LiDAR),
(3) 20 m matching threshold.

## Provenance
- Microsoft data: https://github.com/microsoft/GlobalMLBuildingFootprints
- License: CDLA Permissive 2.0
- Downloaded: 2026-10-17
- Script: ad-hoc Python (shapely, numpy)
