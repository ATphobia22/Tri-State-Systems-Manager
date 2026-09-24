# Inter-Agency Data Governance Memorandum  
**Tri-State Systems Manager (TSM) — Point Township / Posey County Context**

**Date:** 2026-09-24  
**Prepared for:** Posey County Floodplain Administrator; optional courtesy copy to IDNR Division of Water / FEMA LOMC correspondence file  
**Case reference:** FEMA LOMA Case 26-05-2022A  
**Property:** 13101 Bonebank Road, Mount Vernon, Indiana 47620 (Posey County unincorporated; CID 180209)

---

## 1. Purpose

This memorandum describes how the Tri-State Systems Manager (TSM) handles elevation, map, and hydrologic data for decision **support**. It does **not** replace:

- Licensed land surveyor or professional engineer certification  
- FEMA Letter of Map Change (LOMC) determinations  
- USACE project authorization or construction decisions  
- Indiana floodplain permit authority under 312 IAC 10  

TSM’s governing principle: **the system informs people; it does not silently govern people. Human authority remains final.**

---

## 2. Data roles (who owns what)

| Dataset | Primary authority | TSM use |
|---------|-------------------|--------|
| Effective FIRM / NFHL zones & BFE | FEMA | Display + compare; not overridden by TSM |
| USGS 3DEP / Indiana GIO QL2 DEM | USGS / State of Indiana | Elevation context; LAG screening support |
| Live river stage | USGS / NOAA NWPS | Observation only; gage datum fail-closed |
| Navigation pool / lock operations | USACE Louisville District | Context; FOIA for primary records |
| Parcel / assessor | Local government | Location only |
| Certified LAG / structure elevations | Licensed surveyor / PE | Required for MT-1 reliance |

---

## 3. Site constants under active case control (pending certification)

| Parameter | Value | Status |
|-----------|-------|--------|
| Coordinates (approx.) | 37.845887, −88.005075 | Site centroid / twin lock |
| Horizontal CRS | EPSG:2966 (NAD83 / Indiana West, US survey feet) | Project standard |
| Vertical datum | NAVD88 | Project standard |
| BFE (panel context) | 375.0 ft NAVD88 | NFHL / site constants — verify on effective panel |
| LAG (site constant) | 377.2 ft NAVD88 | **Requires surveyor/PE certification before MT-1** |
| Freeboard (LAG − BFE) | +2.2 ft | Arithmetic only until certified |

Alternate stream-segment BFE values observed in public portals (e.g. 368.7 ft) must be **reconciled to the effective panel and FIS**, not mixed silently.

---

## 4. Integrity controls

1. **SHA-256** of primary FEMA correspondence retained (see Layer 2 evidence register).  
2. **Evidence artifacts** labeled `SIMULATION_OR_SITE_CONSTANT` until human-authorized review fields are complete.  
3. **No silent gage-zero conversion** to NAVD88 without published datum.  
4. **Claim controls:** do not assert LOMA approval/denial, intentional agency neglect, or historical insurance overcharge without policy + map + rating evidence.  
5. Form version anomaly on MT-1 attachment (printed 2014 expiration) is **observed** and requires **written FEMA confirmation** — not independently declared invalid by TSM.

---

## 5. Requested local administrative use

TSM packages are offered to reduce manual assembly time for:

1. Case 26-05-2022A additional-information response (deed/plat, assessor map, elevation docs per FEMA letter).  
2. Documentation of when public DEM/LiDAR products were available relative to effective map dates (process lag record — not a lawsuit theory).  
3. Optional referral path discussion for **USACE Section 205** (small flood risk management) if the **non-federal sponsor** (county or other eligible entity) elects to request a study — subject to federal interest, BCA, NEPA, and appropriations.

---

## 6. Contact for technical questions on this package

Anthony Tucker  
13101 Bonebank Road  
Mount Vernon, Indiana 47620  

County Floodplain Administrator (public contact of record): Jerry Cotner — jerry.cotner@poseycountyin.gov  

---

## 7. Closing

Open-source methods can surface discrepancies and accelerate package assembly. They cannot compel Congress to fund a levee, compel USACE to change navigation pools, or compel FEMA to issue a LOMA without the statutory evidence package. This memorandum exists so local and federal reviewers can see **exactly** what TSM claims — and what it deliberately does not claim.
