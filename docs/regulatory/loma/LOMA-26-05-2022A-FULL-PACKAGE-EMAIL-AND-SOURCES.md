# LOMA 26-05-2022A — Full package email + government sources (13101 Bonebank Road)

**Generated from TSM system of record · 2026-11-08**  
**Status:** DRAFT for operator review — attach only human A1–A3 + MSC panel before send.  
**Claim controls:** Do not claim LOMA approved/denied; do not claim FEMA ignored TSM; do not claim historical overcharge without policy + map evidence.  
**Immutable FEMA letter SHA-256:** `8186cbf49bfa5ae415aacaf1b548f75fc02692a5793c30cdebb8cf7f6f20dcde`

---

## 1. Property / case identity (TSM)

| Field | Value |
|-------|--------|
| Case number | **26-05-2022A** |
| Address | **13101 Bonebank Road** |
| Legal / project line | SECTION 35, T7S, R14W |
| Township | Point Township |
| County / state | Posey County, Indiana |
| Community | Posey County, Indiana (Unincorporated Areas) |
| CID (NFIP) | **180209** |
| APN (site constants) | 65-19-08-100-008.001-010 |
| Approximate structure pin | lat **37.84589**, lon **-88.00510** (scientific site anchor) |
| Horizontal CRS (modeling) | EPSG:**2966** NAD83 / Indiana West (ftUS) |
| Vertical datum | **NAVD88** |
| FEMA letter date | **2026-09-22** |
| 90-day target | **2026-12-21** |
| Case status | **ADDITIONAL_INFORMATION_REQUESTED** |
| LOMA determination | **NOT_ISSUED** |

### Scientific elevation constants (TSM — not PE-certified LOMA elevations)

| Constant | Value (ft NAVD88) | Role |
|----------|-------------------|------|
| BFE | 375.0 | Base Flood Elevation (modeling / evidence context) |
| LAG | 377.2 | Lowest Adjacent Grade (modeling context) |
| Clearance (LAG − BFE) | +2.2 | Freeboard-style residual (informational) |
| FFE | 382.5 | Finished Floor Elevation (site constant) |
| Berm crest | 379.8 | Site constant |

These constants support digital-twin / PTDT science. **They do not replace** a licensed surveyor or PE elevation certificate for FEMA MT-1.

---

## 2. FIRM panel issue (must reconcile via MSC)

| Source | Panel |
|--------|--------|
| Operator FIRMette (structure pin) | **18129C0300C** · effective **2014-11-05** · Zone **AE** (as shown on that product) |
| Prior case / TSM FIRM bundle citations | **18129C0265C** |
| NFHL REST (2026-11-08 at pin) | **18129C0300C** returned; **0265C not at pin** |

**Required before send:** FEMA MSC FIRMette/NFHL at structure coordinates; save product; SHA-256; align tax map and narrative to **MSC-only** panel.

---

## 3. Government sources used by TSM (cite in package / cover only as supporting)

### Flood / regulatory
| Source | Authority | How TSM uses it |
|--------|-----------|-----------------|
| FEMA MSC | FEMA | Panel search, FIRMette, FIS products — https://msc.fema.gov/portal/search |
| FEMA NFHL REST | FEMA | Map layers / community context — hazards.fema.gov NFHL services |
| NFIP Community Status (CID 180209) | FEMA | Community identity verification |
| Hardcopy FIRM + FIS (44 CFR 59–78) | FEMA | Official SFHA / BFE authority over viewers |
| Indiana DNR BAFM | State | **Separate** state product — never silently promoted to NFHL |

### Elevation / geodesy
| Source | Authority | How TSM uses it |
|--------|-----------|-----------------|
| USGS 3DEP | USGS | Screening Terrain-RGB / DEM derivative — **not** survey |
| NGS GEOID18 | NOAA NGS | Ellipsoid ↔ orthometric model constraints |
| NGS NCAT API | NOAA NGS | Coordinate transforms (live client) |
| NOAA VDatum API | NOAA NOS | Vertical datum point checks (live client) |
| NAVD88 | NGS/NOAA | Vertical datum for site constants |

### Hydrology (context only; not LOMA elevation proof)
| Source | Authority | How TSM uses it |
|--------|-----------|-----------------|
| USGS NWIS / OGC gauges (e.g. 03378500) | USGS | Stage as **GAGE_DATUM**; NAVD88 conversion **unpublished** until product-matched survey |
| NOAA NWPS | NWS | Operational gauge context (e.g. MTVI3) |

---

## 3A. Tri-State Systems Manager (GitHub) — purpose and features

**Repository:** https://github.com/ATphobia22/Tri-State-Systems-Manager

### Purpose
TSM is an open-source, public-interest information system for the Tri-State River Valley (Indiana–Illinois–Kentucky confluence region). It organizes flood, elevation, geodetic, and community evidence so operators and neighbors can **see** federal and state data in one place.

**Core rule:** Technology informs people; it does not silently govern people. **Human authority remains final.** TSM does not auto-file LOMAs, does not issue regulatory determinations, and does not replace a licensed surveyor or PE.

### Features and functions (relevant to Case 26-05-2022A)

| Area | Capabilities |
|------|----------------|
| **LOMA / case packaging** | Case record JSON, Layer-2 checklists, claim controls (no false approval/denial claims), FEMA letter SHA-256 preservation, panel-mismatch flags |
| **FEMA map fabric** | NFHL layer registry, FIRM panel SSOT notes, REST panel/zone queries (e.g. **18129C0300C** at site pin), MSC-oriented operator procedures |
| **Elevation screening** | USGS 3DEP Terrain-RGB / coverage–nodata reports; labeled **DERIVED / non-FIRM** (not certified LAG) |
| **Geodesy** | NGS-oriented clients and models: NCAT transforms, VDatum checks, GEOID18 constraints; CRS/datum provenance reports |
| **Hydrology (context)** | USGS/NWS stage on demand; gage heights kept in **GAGE_DATUM** unless a published conversion exists |
| **Site science** | 13101 Bonebank constants (BFE 375.0 / LAG 377.2 / FFE 382.5 ft NAVD88) for modeling — not PE-sealed LOMA elevations |
| **Digital twin UI** | Map and 3D twin views, AOI coverage panel, live stage only on explicit user fetch |
| **Trust / governance** | Fail-closed gates, simulation vs observation labels, evidence-store patterns with human authorization, Zero-Trust-oriented auth design |
| **Open source** | Public repository; reproducible scripts and contract tests |

### What to tell FEMA about the repo
Cite it only as the **system used to organize supporting evidence and map citations**. Do **not** claim the repository proves a LOMA without certified elevations, deed/plat, and tax map required by the additional-information letter.

---

## 4. TSM proof artifacts already on file (supporting inventory)

| Artifact | Path / identifier |
|----------|-------------------|
| Case record JSON | `artifacts/04_flood/lomc/26-05-2022A/TSM_FEMA_LOMA_Case_Record_26-05-2022A.json` |
| FEMA letter hash | SHA-256 above |
| NFHL panel query | `NFHL_REST_PANEL_QUERY_2026-11-08.json` |
| Layer-2 checklist | Layer-2 filing checklists under case folder |
| Panel mismatch flag | `FLAG_FIRM_PANEL_MISMATCH_0300C_vs_0265C.md` |
| Site constants | `tsm-site-constants-13101-bonebank.json` |

---

## 5. Email draft — include purpose/features briefly

When writing FEMA, use a short paragraph:

> Evidence and map citations for this property are organized in the open technical system Tri-State Systems Manager (https://github.com/ATphobia22/Tri-State-Systems-Manager). TSM is a public-interest information system for the Tri-State River Valley. It aggregates FEMA NFHL/MSC references, USGS 3DEP screening products, and NOAA NGS geodetic tools; preserves case hashes and claim controls; and presents digital-twin views for operator review. **Human authority remains final.** TSM does not auto-file LOMAs or replace licensed surveyor/PE elevation certification.

Then attach A1–A3 + MSC PDF when available.

Human authority remains final.
