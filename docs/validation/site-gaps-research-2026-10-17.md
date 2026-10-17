# Site Gaps Research — 2026-10-17

## 1. Parcel Discrepancy — RESOLVED

**Finding:** The ~6.4 km discrepancy between the parcel-layer centroid and the legacy "surveyed centroid" is explained. The parcel layer is correct.

- **APN:** 65-19-08-100-008.001-010 (state ID 651908100008001010)
- **Address:** 13101 Bonebank Rd, Mount Vernon, IN 47620
- **Parcel centroid:** 37.8458006, -88.0053513 — only 26.3 m from anchor (37.845887, -88.005075)
- **Polygon contains the anchor point** — the parcel geometry is not misplaced
- The 6.4 km-north coordinates (37.9035, -88.0007) match `fema-mtez-loma-filled.docx`, a document already flagged as fabricated in project records
- **Conclusion:** Trust the parcel layer. The "legacy surveyed centroid" derives from discredited data.

**Sources:** poseyin.wthgis.com (parcel viewer), engage.xsoftinc.com/posey (assessor records)

## 2. Terrain and Elevation Metadata — RESOLVED

### Indiana 2020 LiDAR DEM (Posey County)
- **CRS:** NAD83 Indiana State Plane West (FIPS 1302), US survey feet — EPSG:2968
- **Vertical datum:** NAVD88, GEOID12B, US survey feet
- **Resolution:** 2.5 ft bare-earth hydro-flattened DEM
- **Quality:** QL2
- **Vintage:** Posey County flown spring 2020 (statewide 2016-2020 program)
- **Note:** ImageServer displays in EPSG:3857 — do not use as source metadata

### USGS 3DEP 1m DEM
- **CRS:** EPSG:26916 (UTM Zone 16N, NAD83), meters
- **Vertical datum:** NAVD88, GEOID12B, meters
- **Source:** 2017 Indiana statewide B17 QL2 project (Woolpert)
- **Coverage:** Single 1×1 km UTM tile

## 3. Floodplain BFE — PARTIALLY RESOLVED

**Zone finding:** Anchor falls in Zone AE (SFHA=T), but `STATIC_BFE = NULL` in the DFIRM database. The -9999 sentinel is genuine — the digital FIRM has no BFE at this location. The query is not broken.

**BFE 375.0 ft NAVD88:** Remains a working target from `Bonebank_LOMA_Checklist.pdf` (labeled "Working targets (confirm on FIRM/survey)"). Plausibility check:
- NWS Mount Vernon gauge zero: 318.59 ft NAVD88
- 1937 crest: 59.21 ft stage → 377.80 ft NAVD88 (matches recorded 377.8 ft)
- BFE 375.0 ft is ~2.8 ft below the 1937 crest — hydrologically plausible
- Claimed LAG 377.2 ft would be +2.2 ft above BFE
- **Plausible ≠ confirmed.** Needs FIS tables or survey.

**Still needed:** FIS PDF from MSC (Posey County CID 180209, effective 2014-11-05) or INFIP FARA report.

## 4. HEC-HMS / HEC-RAS — RESEARCHED

- **StreamStats:** Legacy API decommissioned 2026-01-30. Use SS-Delineate v1.2.0 at streamstats.usgs.gov/ss/
- **Site caveat:** Anchor is on the Ohio River — delineation returns full upstream basin (~200k mi²), beyond regression limits. Use gage-ratio transfer from 03381700.
- **HEC-RAS:** USACE Louisville District's Ohio River Community HEC-RAS Model (unsteady 1D, operational) — not publicly downloadable.
- **ERDC TR-22-4:** 2D AdH model (not HEC-RAS). Calibrated with Nov 2018 ADCP + multi-beam bathymetry. Boundaries from 03381700 and 03378500.
- **Key gages:** 03381700 (Ohio at Old Shawneetown), 03378500 (Wabash at New Harmony), 03377500 (Wabash at Mount Carmel), MTVI3 (Mount Vernon NWS)
