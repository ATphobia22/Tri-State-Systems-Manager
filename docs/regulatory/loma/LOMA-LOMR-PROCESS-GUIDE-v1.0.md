# LOMA / LOMR Process Guide (TSM)

**Status:** REFERENCE — informs operators; does not auto-file  
**Case context:** 26-05-2022A (tracked only; LOMA not issued)  
**Authority:** FEMA MT-1 / MT-2 / Online LOMC; 44 CFR Parts 65, 70  
**TSM rule:** Human authority final. No auto_file.

---

## 1. Family of map changes (LOMC)

**LOMC** = Letter of Map Change (umbrella term).

| Product | Ground condition | Revises printed FIRM panels? | Typical form path | Fee |
|---------|------------------|------------------------------|-------------------|-----|
| **LOMA** | Natural grade (no fill for the claim) | No — letter amends SFHA status for structure/lot | MT-EZ (single res.) or MT-1 / Online LOMC | **None** (FEMA review) |
| **LOMR-F** | Elevated by **fill** | No — letter based on fill | MT-1 / Online LOMC | **Yes** (FEMA review fee) |
| **CLOMA / CLOMR-F** | Proposed structure / proposed fill | Comment only (conditional) | MT-1 family | Varies |
| **LOMR** | Physical change to hydrology/hydraulics (channel, levee, better study) | **Yes** — revises FIRM/FIS | **MT-2** | Yes |
| **CLOMR** | Proposed project that would need a LOMR if built | Comment; often needed before construction in floodway | MT-2 | Yes |

---

## 2. LOMA — Letter of Map Amendment

### Purpose
Show that a **structure and/or lot** was mapped into the SFHA but sits on **natural high ground** at or above the **Base Flood Elevation (BFE)** on the **effective** FIRM/FIS.

### Core test
- **Structure removal:** Lowest Adjacent Grade (**LAG**) ≥ **BFE**
- **Lot removal:** Lowest point on the lot ≥ **BFE**
- “Out as shown”: sometimes no elevations if property is clearly outside SFHA on map geometry alone

### Process (practical)
1. Confirm **effective** FIRM panel + community (Posey path: panel **18129C0300C** preferred SSOT pending final packet lock).
2. Obtain **FIRMette** + tax map / plat / deed.
3. Licensed surveyor or PE provides certified elevations (or Elevation Certificate with LAG).
4. File via **Online LOMC** or paper **MT-EZ** / **MT-1**.
5. FEMA completeness check → determination after complete package.
6. If issued: lender may drop **mandatory purchase**; community keeps letter on file.

### What LOMA is not
- Not a rewrite of neighborhood floodways/BFEs  
- Not proof that BAFL/INFIP agrees  
- Not automatic premium reduction under Risk Rating 2.0

---

## 3. LOMR-F — Letter of Map Revision Based on Fill

### Purpose
Same SFHA removal goal when the site was raised by **fill** (not pure natural grade).

### Extra requirements
- LAG ≥ BFE  
- Community must find site **“reasonably safe from flooding”**  
- Fill placement must have been lawful under floodplain rules  
- **LiDAR alone is not accepted for LOMR-F** the way some LOMA paths discuss BLE/LiDAR support  

### Fee
FEMA charges review/processing fees (unlike standard LOMA).

---

## 4. LOMR — Letter of Map Revision (MT-2)

Official revision of the effective FIRM/FIS because hydrology/hydraulics or mapping data changed. Community CEO concurrence; PE H&H analysis; floodway projects often need **no-rise** demonstration.

---

## 5. Indiana dual maps vs LOMC

| Layer | Use for LOMA/LOMR? |
|-------|--------------------|
| **Effective NFHL / FIRM** | **Yes — only** insurance/LOMC comparison base |
| **Indiana BAFL / INFIP** | Local permitting / FARA; **does not** replace FIRM for LOMA eligibility |
| **USGS stage / NWPS** | Context only — not LAG/BFE survey |
| **3DEP / LiDAR** | May support some LOMA elevation narratives; survey still typical |

---

## 6. TSM case 26-05-2022A (operator constraints)

| Item | Status |
|------|--------|
| Application / case | Tracked; **ADDITIONAL_INFORMATION_REQUESTED** |
| 90-day style deadline | **2026-12-21** (verify against letter) |
| LOMA issued? | **No** |
| TSM auto_file | **false** |

Working site elevations (uncertified unless survey packet says otherwise):

| Benchmark | Value (ft NAVD88) |
|-----------|-------------------|
| BFE (working) | 375.0 |
| LAG (owner/working) | 377.2 (+2.2 freeboard vector) |
| FFE | 382.5 |
| Berm design | 379.8 |

---

## 7. TSM software boundaries

| Allowed | Forbidden |
|---------|-----------|
| Track case status, checklist, panel SSOT | Auto-submit to FEMA |
| Display NFHL vs BAFL as separate layers | Merge BAFL into insurance determination |
| Store SHA-256 evidence packages | Invent LAG/BFE or “LOMA approved” |
| Button-fetch live stage for context | Use gage stage as LOMA elevation |

**References:** FEMA LOMA/LOMR-F process pages; MT-1 Technical Guidance; Online LOMC FAQ; 44 CFR 65 & 70.
