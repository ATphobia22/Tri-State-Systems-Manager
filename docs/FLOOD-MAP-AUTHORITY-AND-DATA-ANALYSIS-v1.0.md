# Flood Map Authority & Data Analysis (TSM)

**Date:** 2026-10-08  
**Scope:** Posey County / Tri-State River Valley digital twin  
**Rule:** REGULATORY ≠ PLANNING ≠ OBSERVATION

---

## 1. Map products in the twin

| Layer class | Source | Authority class | TSM use |
|-------------|--------|-----------------|---------|
| Effective SFHA / zones / panels | FEMA NFHL MapServer | **REGULATORY** | LOMA comparison, SFHA flag, FIRMette |
| BFE lines / FIS-backed elevations | NFHL S_BFE + FIS | **REGULATORY** (when published) | Compare to certified LAG only |
| Indiana Best Available (BAFL) | IDNR / INFIP | **PLANNING / local regulatory** | Permit context; never insurance SSOT |
| USGS 3DEP Terrain-RGB | USGS | **ELEVATION / OBSERVATION** | Twin terrain; not LOMA LAG |
| Live stages | USGS OGC / NOAA NWPS | **OBSERVATION** | Hydrologic context; GAGE_DATUM |
| USACE NLD levees | USACE | **REGULATORY context** | Residual risk / protected area |
| Parcels / buildings | IGIO / county | **CONTEXT** | Location fabric |

---

## 2. Site flood-map facts (working)

| Fact | Value | Confidence |
|------|-------|------------|
| Horizontal CRS | EPSG:2966 (Indiana West ftUS) preferred in twin | High (project standard) |
| Vertical | NAVD88 | High as datum label |
| NFHL zone @ Bonebank sample | **AE**, SFHA_TF = T | High (NFHL query) |
| Panel SSOT target | **18129C0300C** (eff. ~2014-11-05) | Medium-High — resolve doc conflicts (0215/0265) |
| Working BFE | 375.0 ft NAVD88 | Working / checklist — not PE-sealed unless packet says so |
| Working LAG | 377.2 ft NAVD88 | Owner/working |
| Case | 26-05-2022A | Open; AI requested |

**Panel hygiene:** Historical docs cited 0265C / 0215C / 0225D. FIRMette operator note preferred **0300C**. TSM must show **one** primary panel in LOMA packets and flag mismatches.

---

## 3. Hydrology vs map (analysis)

| Event | New Harmony stage | Evansville stage | Map implication |
|-------|-------------------|------------------|-----------------|
| Now (low) | ~3.2 ft | ~14 ft | No flood category; does not change FIRM |
| 2024 peak | ~16.9 ft | moderate year | Event severity ≠ map revision |
| 2025 peak | ~22.5 ft (near major) | **47.67** (minor≈moderate) | Validates hazard; LOMA still elevation-vs-BFE on **effective** map |

Gage → NAVD88 requires published gage-zero; TSM fail-closed until verified.

---

## 4. Insurance rate vs map

- **Mandatory purchase:** driven by **effective SFHA** on FIRM/NFHL (and lender rules).  
- **Premium (RR 2.0):** property-specific models (elevation, distance to water, rebuild cost, etc.) — **not** simple zone lookup.  
- Removing SFHA via **LOMA** can end federal mandate; premium path is separate (EC may help).  
- **BAFL** cannot by itself end mandatory purchase.

**TSM claim control:** Do not assert “overcharged because BAFL differs from FIRM” without a documented LOMA outcome + rating record.

---

## 5. Data quality gates

| Check | Pass condition |
|-------|----------------|
| NFHL query | HTTP 200, features or explicit empty |
| Rejected obs | −999, obs_not_current |
| Terrain | Fail-closed without valid Terrain-RGB template |
| Buildings | f=pjson; SHA-256 snapshot fallback if IGIO 504 |
| Evidence publish | human_authorization required |

---

## 6. Implementation already aligned

- Separate FEMA vs Indiana planning layers  
- Button-only live hydrology  
- Case tracking without auto-file  
- Offline county packs with hash receipts  

## 7. Remaining gaps

1. Single FIRM panel SSOT in all LOMA docs  
2. CID consistency (180209 vs other citations)  
3. Survey-grade LAG/BFE sealed for case response before 2026-12-21  
4. Optional UI: LOMA checklist component (shadcn-style) + Storybook for AuthorityBadge / gauge board
