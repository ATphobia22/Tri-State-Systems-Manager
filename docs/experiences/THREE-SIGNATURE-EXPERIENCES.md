# Three signature experiences

| Experience | Route | Core rule |
|------------|-------|-----------|
| Living River Valley | `/experience/living-river` | Real NFHL / 3DEP / NWPS / USGS; gage discipline |
| Engineering Scenario Sandbox | `/experience/scenario-sandbox` | freeboard = LAG − BFE; explicit uncertainty |
| Evidence-to-Cinema Storyboard | `/experience/evidence-storyboard` | Cinema cannot change evidence |

## Gage zero (verified 2026-11-10)

**Station MTVI3** (Ohio River at Mount Vernon, IN) — NOAA NWPS  
https://water.noaa.gov/gauges/mtvi3

| Product field | Value |
|---------------|-------|
| Gauge Zero NAVD88 | **318.59 ft** |
| Gauge Zero NGVD29 | 318.92 ft |
| Minor flood stage | 35 ft (above zero) → WSE ≈ 353.59 ft NAVD88 |
| 1937 crest stage | 59.21 ft → WSE ≈ **377.80 ft NAVD88** |

**Discipline module:** `packages/geo/src/hydrology/GageDatumDiscipline.ts`

- Stage ≠ NAVD88 without adding **this station’s** published zero  
- Do not apply MTVI3 zero to other USGS IDs  
- Do not confuse NWIS `alt_va` with operational gage zero  

Human authority remains final.
