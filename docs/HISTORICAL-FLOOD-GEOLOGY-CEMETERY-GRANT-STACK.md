# Historical Flood · Geology · Weiss Cemetery · Grant Stack

**Status:** Reference evidence for PE / agency review — **not** a LOMA, No-Rise, or grant award.  
**Site context:** 13101 Bonebank Rd, Point Township, Posey County, IN · NAVD88 site constants.  
**Updated:** 2026-09-02

---

## 1. NAVD88 datum shifts (what agencies need to know)

### What changed

| Datum | Era | Nature |
|-------|-----|--------|
| **NGVD29** | 1929 general adjustment | Multi-tide-gauge “sea level”; accumulated leveling distortions |
| **NAVD88** | 1991 adjustment | Single constrained origin (Father Point / Rimouski); Helmert orthometric heights |

Federal civil work and modern FIRM/FIS products use **NAVD88**. Older paper maps, some historic crest tables, and legacy engineering may still quote **NGVD29**.

### Algebra

NGS convention (VERTCON / NCAT):

```text
height_NAVD88 = height_NGVD29 + (NAVD88 − NGVD29)_model
height_NGVD29 = height_NAVD88 − (NAVD88 − NGVD29)_model
```

At MTVI3 (NWS published table):

| Category | NAVD88 | NGVD29 | Δ |
|----------|--------|--------|---|
| Gauge zero | 318.59 | 318.92 | **−0.33 ft** |
| Minor flood | 353.59 | 353.92 | −0.33 ft |
| Major flood | 370.59 | 370.92 | −0.33 ft |

**Rule for TSM:** never mix datums in one clearance equation. Convert first, then compare to BFE/LAG (NAVD88).

VERTCON is a **model** (~2 cm RMS class for mapping). **Construction / LOMA** needs PE leveling or published NAVD88 bench marks—not VERTCON alone.

Tool: [NGS NCAT / VERTCON 3.0](https://www.ngs.noaa.gov/VERTCON3/)

---

## 2. USGS NWIS API (operator recipes)

Base pattern:

```text
https://waterservices.usgs.gov/nwis/{service}/?format=json&sites={id}&parameterCd={codes}
```

| Service | Path | Use |
|---------|------|-----|
| Instantaneous | `/nwis/iv/` | Live gage height **00065**, discharge **00060** |
| Daily | `/nwis/dv/` | Daily means |
| Site | `/nwis/site/` | `alt_va`, `alt_datum_cd` (gage zero / land surface) |
| Peak | peak flow pages | Historic crests |

**Posey nodes**

| Site | Role |
|------|------|
| 03378500 | Wabash @ New Harmony |
| 03322000 | Ohio @ Evansville |
| 03322420 | Ohio @ Uniontown Dam / Myers area |

**Critical:** `parameterCd=00065` values are **GAGE_DATUM**. Add published zero for WSE_NAVD88.

Docs: [Instantaneous Values Service](https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/)

---

## 3. Historical flood simulation sources (berm / placement verification)

Use these as **observation layers**, not as proof that a berm “should have been” present.

### NASA

| Product | What it gives |
|---------|----------------|
| **MODIS MCDWD_L3** reprocessed archive **2003–2025** | Daily ~250 m flood water maps (LAADS DAAC) |
| **VIIRS NRT Global Flood** | Near-real-time successor path |
| Landsat event pairs | e.g. May 2011 Ohio–Wabash confluence inundation (NASA Earth Observatory / Landsat 5) |

LAADS: `https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/61/MCDWD_L3/`  
User guide: NASA Earthdata NRT Global Flood Products

**How to use for berm narrative**

1. Pick crest dates from NWS MTVI3 / UNWK2 historic tables (1937, 1913, 2011, 2025, …).
2. Pull NASA/MODIS or Landsat scenes ±2 days of crest.
3. Overlay structure footprint + proposed berm polyline in EPSG:2966 / NAVD88 elevation model.
4. Compare observed inundation extent to simulated stage planes (gage_height + zero).
5. Document residual uncertainty (cloud, 250 m pixels, tree canopy).

### USGS Flood Inundation Mapping

- **Wabash at New Harmony (03378500)** — SIR 2016-5119 stage–inundation library  
  `https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf`  
- OKI FIM program hub for additional reaches  

### NWS impact statements (MTVI3)

- **45 ft stage:** “Large portions of Point Township in Posey County are flooded.”  
- Historic crest **59.21 ft (1937)**; major **52 ft**; record class events 1913, 2011, 1945, 1884.

### USFIMR

U.S. Flood Inundation Mapping Repository (remote-sensing event extents) for calibration support: University of Alabama SDML USFIMR.

**TSM policy:** historical layers = **OBSERVATION / VISUALIZATION**. Berm design still requires PE + IDNR/FEMA process.

---

## 4. Henry H. Gray geological records (verified)

**Henry Hamilton Gray (b. 1922)** — long-time Indiana Geological & Water Survey stratigrapher; **not** “Henry Greys.” Key works for SW Indiana / Posey context:

| Work | Year | Relevance |
|------|------|-----------|
| Bedrock Geologic Map of Indiana (Gray, Ault, Keller) | 1987 | Statewide bedrock foundation |
| Quaternary Geologic Map of Indiana, MM 49 | 1989 | Glacial / alluvial cover |
| Carboniferous Systems in the U.S.—Indiana (USGS PP) | 1979 | Mississippian–Pennsylvanian |
| Rocks associated with Miss.–Penn. unconformity (Guidebook 9) | 1957 | SW Indiana field context |
| West Franklin Limestone Member, Posey County | 2011 | Local stratigraphy |

**Earlier Posey county geology:** Collett, J. (1884), *Geology of Posey County*, 13th Annual Report — coals, fossils, Wabash alluvium (historical baseline).

**Physiography / hazards context:** Wabash Valley Fault System (post-Pennsylvanian to pre-Pleistocene activity class in literature) — engineering geology awareness only; seismic design is separate code path.

**Access:** [IU ScholarWorks / IGWS](https://scholarworks.iu.edu/) · NGMDB · IGWS bedrock/Quaternary products.

Use Gray maps for **substrate / alluvium / coal measures context** under berm and structure—not as flood stage authority.

---

## 5. Weiss Cemetery — Historical Family Cemetery

| Field | Value |
|-------|--------|
| **Name** | Weiss Cemetery (aka **Zoar Church Cemetery**) |
| **County** | Posey County, Indiana |
| **Township listing** | Black Township (INGenWeb / RootsWeb) |
| **Address context** | ~2800 Zoar Church Road |
| **Coordinates** | ≈ **37.8922°N, 87.9778°W** (Find a Grave / RootsWeb) |
| **Find a Grave ID** | **87319** |
| **TSM role** | **Historical Family Cemetery** — cultural / family stewardship node |

**Nearby family / historic cemeteries (context):** Ries Family, Leonard Floyd Family, Mount Pleasant Emancipation, Conlin/Rowe (Point Twp.), Greathouse-Stripe (Point Twp.).

**Bone Bank archaeological note (distinct):** Caborn-Welborn village / early U.S. archaeology (Lesueur 1828); riverbank erosion of prehistoric burials — **not** the same as Weiss Cemetery. Keep separate EvidenceArtifact types: `historical_family_cemetery` vs `archaeological_site`.

**Governance:** Cemetery mapping is for respect, access, and grant narrative (heritage / community resilience)—**not** for floodway fill justification without PE and statutory process.

---

## 6. Grant stacking — verified programs (assemble records, do not auto-apply)

Stack only what is **eligible, non-duplicative, and match-clean**. Federal funds generally **cannot** match other federal funds unless a specific exception applies.

### Federal / FEMA (through IDHS as applicable)

| Program | Purpose | Typical share | Notes (2025–2026) |
|---------|---------|---------------|-------------------|
| **BRIC** | Pre-disaster mitigation, infrastructure, nature-based | Often 75/25 | IDHS cycle; plan adoption required |
| **HMGP** | Post-declaration mitigation | Varies | Disaster-dependent |
| **FMA** | NFIP-related flood mitigation | Per HMA Guide | Insured / repetitive loss focus |
| **PDM CDS (FY26)** | Congressionally directed projects | Per NOFO | National list; IN example was Indianapolis Howland Ditch design — **not** automatic Posey entitlement |
| **Public Assistance** | Declared disaster response/repair | Often 75/25 | Governments / certain PNPs |

HMA Guide v2.1 effective **2025-01-20** (HMGP, BRIC, FMA policy spine).

Indiana hub: [IDHS Mitigation](https://www.in.gov/dhs/emergency-management-and-preparedness/mitigation-and-recovery/) · `mitigation@dhs.in.gov`

### State / other

| Program | Agency | Fit |
|---------|--------|-----|
| **§319 Nonpoint Source** | IDEM | Watershed BMPs; **not** pure flood control structures; ~60/40 typical; annual solicitation |
| **§205(j)** | IDEM | Planning; **cannot** fund dredging/flood control implementation |
| **CCMG / local capital** | State/local cycles | Confirm current Indiana OCRA / county windows |
| **USDA SEARCH / rural** | USDA | Ongoing eligibility checks |

### Record package checklist (grant-ready)

1. **Parcel / APN** + ownership + tax map  
2. **FIRM panel** 18129C0300C + FIS excerpt + LOMC list  
3. **Elevations** PE survey: BFE / LAG / FFE / berm crest (NAVD88)  
4. **Hydrology** provisional stages with GAGE_DATUM + conversion table  
5. **Photos / drone** dated; Merkle hash optional  
6. **Benefit-Cost** draft (FEMA BCA toolkit if HMA)  
7. **Match sources** documented (non-federal)  
8. **Hazard Mitigation Plan** citation (county/state adoption)  
9. **Environmental / historic** screening (Weiss Cemetery / Bone Bank sensitivity)  
10. **Letters** of support (township, APC, floodplain admin)

**TSM may store evidence; TSM must not submit grants or certify cost-effectiveness.**

---

## 7. Branch delete reminder

Remote branch deletion requires **your** authenticated `git push`:

```bash
git push origin --delete ci/lockfile-repair-2026-08-31
# … (remaining list in docs/BRANCH-HYGIENE.md)
```

This environment cannot push credentialed deletes on your behalf.

---

*Human authority final. Technology informs.*
