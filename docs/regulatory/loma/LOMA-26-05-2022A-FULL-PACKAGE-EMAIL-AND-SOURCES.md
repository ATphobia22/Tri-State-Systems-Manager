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
| NFHL manifest (repo) | Lists **18129C0300C** as NFHL_REST_VERIFIED; **18129C0265C** PENDING_SOURCE_VERIFICATION |

**Required before send:** FEMA MSC FIRMette/NFHL at structure coordinates; save product; SHA-256; align tax map and narrative to **MSC-only** panel. Do not assert 0265C if MSC shows 0300C.

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

### Parcel / site
| Source | Authority | How TSM uses it |
|--------|-----------|-----------------|
| Posey County parcel / assessor context | Local | AOI geometry; **assessor map for FEMA must be official county product with FIRM intersection** |
| Site constants package | Owner / TSM | Modeling anchors — disclosed as scientific |

---

## 4. TSM proof artifacts already on file (supporting inventory)

| Artifact | Path / identifier |
|----------|-------------------|
| Case record JSON | `artifacts/04_flood/lomc/26-05-2022A/TSM_FEMA_LOMA_Case_Record_26-05-2022A.json` |
| FEMA letter hash | SHA-256 above; source filename reference `26-05-2022A-092226.pdf` |
| Layer-2 checklist | `LAYER2_FILING_CHECKLIST_2026-11-07.md` / `LOMA-26-05-2022A-LAYER2-CHECKLIST.md` |
| Panel mismatch flag | `FLAG_FIRM_PANEL_MISMATCH_0300C_vs_0265C.md` |
| Evidence register CSV | `TSM_Evidence_Layer2_Evidence_Register.csv` |
| Site constants | `tsm-site-constants-13101-bonebank.json` |
| NFHL/FIRM manifest | `data-sources/manifests/fema-nfhl-firm.json` |
| 3DEP terrain manifest | `data-sources/manifests/usgs-3dep-terrain.json` |
| AOI coverage report | `scripts/reports/aoi-terrain-coverage-nodata-report.mjs` outputs |
| CRS provenance report | `scripts/reports/crs-provenance-per-source-report.mjs` outputs |
| NCAT / VDatum clients | `packages/geo/src/geodesy/NcatClient.ts`, `VDatumClient.ts` |
| Gage-zero gate | `conversionPublished: false` for local gauges |

---

## 5. Email draft (copy into operator mail client)

**To:** [FEMA MT-1 contact from 2026-09-22 letter]  
**Cc:** [Posey County floodplain administrator / counsel]  
**Subject:** Case 26-05-2022A — Additional Information Response — Posey County IN (CID 180209) — 13101 Bonebank Road

Dear FEMA MT-1 Reviewer,

This submission responds to the Additional Information request dated **22 September 2026** for Case **26-05-2022A**.

**Property:** 13101 Bonebank Road, Point Township, Posey County, Indiana (Unincorporated Areas), NFIP Community Number **180209**, described as Section 35, Township 7 South, Range 14 West.

**Case status acknowledged:** Additional Information Requested; Letter of Map Amendment determination **not** issued as of this writing.

### Enclosures (check only items physically attached)

- [ ] **A1** — Recorded property deed **or** recorded subdivision plat (recordation data and Recorder stamp)
- [ ] **A2** — Local tax assessor map locating the property and including a street intersection shown on the applicable FIRM panel
- [ ] **A3** — Elevation documentation certified by a licensed land surveyor or registered professional engineer (MT-1 Form 2, **or** Elevation Certificate accepted in lieu for a structure request)
- [ ] **A4** — Written confirmation of the currently accepted elevation form/procedure for this case (if obtained; observed file materials include DHS-FEMA Form 086-0-26A with printed expiration 2014-02-28)
- [ ] **B1** — MSC-confirmed FIRM panel product for the structure (operator FIRMette indicates **18129C0300C**, effective 2014-11-05, Zone AE on that product; case materials have cited **18129C0265C** — this response uses the MSC-confirmed panel only)
- [ ] Copy of the original FEMA letter dated 22 September 2026 (unchanged)

### Panel reconciliation request

Please confirm the **effective FIRM panel** governing the structure. We will align all location exhibits to the MSC/NFHL single source of truth and will not assert a panel ID that MSC does not support for the structure coordinates.

### Form version request

Please confirm in writing the **currently accepted** elevation data form or Elevation Certificate procedure for Case 26-05-2022A so that certified elevations are submitted on the correct instrument.

### Supporting technical context (explicitly non-regulatory)

The owner maintains a technical evidence system (Tri-State Systems Manager) that organizes FEMA NFHL/MSC references, USGS 3DEP screening elevation products, NOAA NGS geodetic tools (GEOID18, NCAT, VDatum), and site modeling constants (including BFE 375.0 ft NAVD88 and LAG 377.2 ft NAVD88 as **modeling context only**). That material is **not** offered as a substitute for certified elevations or the effective FIRM/FIS. Human professional certification and FEMA determination remain controlling.

Please identify any remaining deficiencies prior to the **21 December 2026** response target.

Respectfully,  
[Name]  
[Title]  
[Phone]  
[Email]  
Case: 26-05-2022A · CID 180209 · 13101 Bonebank Road, Posey County, IN

---

## 6. Operator checklist before send

1. Collect A1, A2, A3 (and A4 if available).  
2. Pull MSC FIRMette/NFHL at 37.84589, -88.00510 (or surveyed structure point); hash file.  
3. Check only true enclosures on the email.  
4. Do not attach unverified DEM/EPQS as “certified LAG.”  
5. Send from operator account; log tracking ID; update case JSON only after real submission.

Human authority remains final.
