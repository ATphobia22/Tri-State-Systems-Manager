# MSC / NFHL panel reconciliation run — 2026-11-08

**Case:** 26-05-2022A · 13101 Bonebank Road · pin `-88.00510, 37.84589` (lon, lat)

## Steps completed in TSM (automated assist)

| Step | Result |
|------|--------|
| 1–2 MSC path | Operator still opens [msc.fema.gov](https://msc.fema.gov) for official FIRMette PDF download |
| 3–4 NFHL REST | Queried `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` layers **3** (FIRM Panels) and **28** (Flood Hazard Zones) |
| Panel at pin (IN) | **18129C0300C** · suffix C · effective **2014-11-05** · countywide printed · scale 24000 |
| Also intersects geometry | **17059C0150D** (Gallatin Co IL) — river/state-line context; **not** the Indiana structure panel |
| **18129C0265C** at pin | **Not returned** by FIRM Panels intersect |
| Zone at pin | **AE** · SFHA_TF = T · STATIC_BFE attribute absent (−9999) |
| Evidence file | `artifacts/04_flood/lomc/26-05-2022A/NFHL_REST_PANEL_QUERY_2026-11-08.json` |
| SHA-256 | `05ef768da6129b0b5a052309beacb88ff3dab6aec5d2d1b1598d2d5b0e33960b` |

## Steps still operator-only

5. Optional NFHL Viewer visual check  
6. Align tax assessor map + narrative to **18129C0300C** (unless MSC PDF shows otherwise)  
7. Download MSC FIRMette/PDF, hash, file under case evidence; update case JSON after human review  
8. Call **1-877-FEMAMAP** / FEMA-FMIX@fema.dhs.gov if pin placement is disputed  

## Claim controls

- Do not treat this REST query as a LOMA determination.  
- Do not invent BFE from STATIC_BFE −9999.  
- A1–A3 human documents remain required.

Human authority remains final.
