# INFIP / FARA Site Review Contest — Cover Statement

**Case:** FEMA LOMA 26-05-2022A  
**Property:** 13101 Bonebank Road, Point Township, Posey County, Indiana (Unincorporated)  
**Community Number:** 180209  
**FIRM Panel (cited):** 18129C0265C  
**Coordinates (WGS84, evidence lock):** 37.845887, −88.005075  
**Date prepared:** 2026-09-25  

---

## Purpose

This package supports a **site-specific review** of Floodplain Analysis and Regulatory Assessment (FARA) / INFIP outputs for the property above. It is submitted so Indiana DNR Division of Water and the local floodplain administrator can compare **published** elevation and map products against **site constants** already recorded in the citizen evidence ledger.

This is **not** a claim that LOMA has been approved or denied. FEMA case status as of the latest TSM case record: **ADDITIONAL_INFORMATION_REQUESTED** (letter dated 2026-09-22; 90-day track **2026-12-21**). LOMA determination: **NOT_ISSUED**.

---

## Site constants (NAVD88 feet) — SIMULATION_OR_SITE_CONSTANT

| Parameter | Value (ft NAVD88) | Role |
|-----------|-------------------|------|
| Base Flood Elevation (TSM effective constant) | **375.0** | Regulatory BFE used in TSM freeboard arithmetic |
| Alternate stream BFE noted in catalogs | **368.7** | **Not** substituted for 375.0 without product citation |
| Lowest Adjacent Grade (LAG) | **377.2** | Site constant — **requires PE/surveyor certification for MT-1** |
| First Floor Elevation (FFE) | **382.5** | Site constant |
| Berm crest | **379.8** | Site constant |
| LAG − BFE (vs 375.0) | **+2.2** | Arithmetic only |

**Horizontal CRS:** EPSG:2966 (NAD83 / Indiana West, US ft)  
**Vertical datum:** NAVD88  

---

## What is requested

1. Confirm whether INFIP/FARA identifies this structure using the correct stream segment and BFE product for panel **18129C0265C**.  
2. If the portal’s automated assessment conflicts with the site constants above, accept this package as **supporting technical documentation** for a site review.  
3. Advise the submitter of any **additional certified elevation** items required under Indiana and NFIP practice.

---

## Claim controls (mandatory)

- Do **not** treat this cover sheet as a FEMA LOMA determination.  
- Do **not** assert historical NFIP overcharge without policy and map-version evidence.  
- Do **not** treat LiDAR/DEM pixels alone as certified LAG.  
- MT-1 / elevation forms require **licensed land surveyor or PE** certification as stated in FEMA’s additional-information letter.  
- Form 086-0-26A printed expiration anomaly (2014-02-28) remains **REQUIRES_FEMA_CONFIRMATION** — not independently declared invalid by TSM.

---

## Attachments (suggested)

1. `evidence_lock_packet.json`  
2. `TSM_FEMA_LOMA_Case_Record_26-05-2022A.json`  
3. FEMA additional-information letter PDF (control digest `8186cbf49bfa5ae415aacaf1b548f75fc02692a5793c30cdebb8cf7f6f20dcde` when source file available)  
4. Layer 2 evidence register CSV  
5. Output of `scripts/validation/validate_panel_sha256.py`

---

## Contact for local coordination

Posey County Floodplain Administrator (public contact on county materials): Jerry Cotner — jerry.cotner@poseycountyin.gov  

**Prepared by:** Independent open-source evidence package (Tri-State Systems Manager) — human authority remains final.
