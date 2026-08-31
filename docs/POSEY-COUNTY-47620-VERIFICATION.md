# Posey County / 47620 verification notes (web + project)

ZIP **47620** serves Mount Vernon / Point Township area of Posey County, Indiana.

## Site — 13101 Bonebank Road

| Field | Project value | Verification note |
|-------|---------------|-------------------|
| APN | 65-19-08-100-008.001-010 | County assessor / site constants |
| BFE | **375.0 ft NAVD88** | Site constants / LOMA pack |
| LAG | **377.2 ft NAVD88** | Claimed sealed survey (+2.2 ft) |
| CRS | EPSG:**2966** / NAVD88 | Analysis frame |
| LiDAR tile | IN2020_26800940_12 | Low-ground tile; LAG outside tile max |

**Actionable gap (confirmed):** structure LAG sits above low-ground tile envelope — pull **adjacent higher tiles** or county DEM mosaic before final LAG extraction.

## NFIP community IDs (FIS / CIS)

| Community | CID |
|-----------|-----|
| Posey County (Unincorporated)* | **180209** |
| Mount Vernon, City of | **180389** |
| New Harmony, Town of | **180210** |

Source pattern: FEMA Community Status Book / Posey County FIS materials (countywide FIS number family **18129CV…**).

## Dual authority

| Authority | Role |
|-----------|------|
| FEMA | NFIP, FIRM/NFHL, LOMA/LOMR (44 CFR Part 70) |
| IDNR Division of Water | Best Available Flood Hazard Layer, INFIP, FARA for many state permitting paths |
| USACE Louisville | Navigable Wabash/Ohio, CAP / structural programs |

BAFM county downloads (shapefile, UTM 16N NAD83 meters) are published by IDNR — reproject deliberately into EPSG:2966 for analysis.

## LiDAR access (public)

- Indiana GIO Elevation Program: https://elevation.gio.in.gov/pages/access  
- Purdue / Digital Forestry STAC: https://stac.digitalforestry.org/ (point cloud, DTM, DSM, NDHM catalogs)  
- QL2 3DEP 2016–2020 final products; RMSEz non-veg ≤ 0.328 ft (spec)

## Grant timing (operator must re-verify NOFO dates)

Treat CCMG / OCRA / §319 / USDA windows as **CURRENT/MONITOR** until the live agency page for the cycle is checked. Do not auto-submit applications from TSM.

## Evidence plane next steps

1. Download adjacent LAS/LAZ + seal SHA-256  
2. PDAL Class 2 + foundation buffer LAG  
3. Human package → FEMA Online LOMC + concurrent IDNR as required  
4. Ledger: OBSERVATION (tiles) → DERIVATION (LAG) → human decision
