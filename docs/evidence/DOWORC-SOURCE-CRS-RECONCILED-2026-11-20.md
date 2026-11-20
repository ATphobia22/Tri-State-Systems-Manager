# Reconciled DNR source CRS evidence — 2026-11-20

**Source acquisition:** All eight DNR hydrogeology archives were found in the private Google Drive folder “Indiana DNR DoWORC Hydrogeology — Source Originals 2026-11-19” (outer bundle created 2026-11-19). Outer bundle SHA-256: `bbbcfffe60245679be7e820cf70decb8e9dbd585d62b80fd28c211ad93875ed3`. All eight original nested ZIP CRCs passed and all eight SHA-256 values independently matched both the acquisition receipt and `SHA256SUMS.txt`.

**Reproducible strict audit:** `scripts/geo/reconcile_doworc_zip_crs.py --bundle <original-bundle.zip> --output <audit.json>`; Python dependencies `pyproj` and `pyshp`. Independently run on recovered source bundle with pyproj 3.7.2 / PROJ 9.5.1. Its expected exit status was **2 / evidence incomplete**, not successful release.

| County | PSM family | Aquifer system family |
|---|---|---|
| Gibson | 16 × EPSG:26916 | 17 × EPSG:26716; 3 × EPSG:26916 |
| Posey | 15 × EPSG:26916 | 13 × EPSG:26716; 1 × EPSG:26916 |
| Vanderburgh | 15 × EPSG:26916 | 12 × EPSG:26716; 2 × EPSG:26916; 1 unknown |
| Warrick | 15 × EPSG:26916 | 13 × EPSG:26716; 2 × EPSG:26916 |

**125 total:** 69 NAD83/UTM 16N (EPSG:26916), 55 NAD27/UTM 16N (EPSG:26716), 1 projection unknown (`tr_van.shp`, Vanderburgh aquifer ZIP lacks `.prj`). Both projected CRS axes are **metres**; TSM target EPSG:2966 uses **US survey feet**.

**Numerical transforms:** 69 source-layer sample coordinates transformed using strict EPSG:26916→2966; greatest forward/reverse numerical difference **1.8852454075e−9 m**. This is a software arithmetic check **not an independent accuracy estimate**.

**Missing transformation resource:** PROJ identified `us_noaa_nadcon5_nad27_nad83_1986_conus.tif` as unavailable, so `TransformerGroup(26716,2966, allow_ballpark=False)` has **no eligible executable operation**. All 55 NAD27 layers stay excluded from accepted target output. Use the officially licensed PROJ/NGS grid, pin it and record its SHA-256 and the chosen pipeline; **do not** silently fall back to a ballpark shift.

**Offline grid rerun:** The official PROJ CDN CONUS NADCON5 grid, SHA-256
`c7d587e0d0b39b9f46c7de850b9a6a468c17b7139f82a313aa43aa4a64d94fa8`, was
staged locally. With network grid access disabled, all 55 NAD27 layer
samples transformed via the best non-ballpark operation. The combined
count was 124 of 125, with `tr_van.shp` still lacking its original projection.
Replay with `PROJ_NETWORK=OFF python scripts/geo/reconcile_doworc_zip_crs.py
--bundle ORIGINAL.zip --nadcon-grid PATH_TO_GRID --output receipt.json`.
Exit 2 records incomplete layer evidence. The output keeps surveyed control
and vertical datum unverified.

**Independent agency geometry:** Indiana GIO [Current County Boundaries](https://gisdata.in.gov/server/rest/services/Hosted/County_Boundaries_of_Indiana_Current/FeatureServer/0) was queried by point-in-polygon for eight source samples: two for each county, including a NAD27 and a NAD83 sample. All **8/8** returned the correct county FIPS (`18051`, `18129`, `18163`, `18173`). NAD27 geographic approximations are allowed **only** to check county-scale plausibility, never for promoted output. This does not quantify known-point geodetic residuals or validate the full feature population.

**Vertical frame:** DNR PSM metadata describes mapped static water level; Gibson `Swl_E` defines a **10-foot** contour interval. Other PSM numeric attributes include `swl`, `static_e`, and `Static_e`. **Neither NAVD88 nor NGVD29 has been established for this source family**. Do not join these contour values to NAVD88 terrain or derive regulatory BFE until an authoritative vertical datum and source units are documented.

**Source permissions:** DNR map metadata discourages redistribution or adaptation without express written consent. Keep original licensed/source ZIPs in the private Drive evidence warehouse; publish small provenance metadata and checksums, not binary originals, without licensing review.

**Release status:** `SOURCE_CRS_RECONCILED_WITH_GAPS`; **engineering promotion BLOCKED**. Close by verifying NADCON5 grid transformation against surveyed known control, resolving `tr_van.shp` original projection, validating vertical datum and polygon population, and running CI before merge. The source metadata is not a substitute for FEMA/NFHL effective regulatory evidence.

Official source documentation:
- https://www.in.gov/dnr/water/online-research-center/
- https://www.in.gov/dnr/water/ground-water-wells/assessment-maps-and-publications/potentiometric-surface-mapping-148000/
- https://www.in.gov/dnr/water/ground-water-wells/assessment-maps-and-publications/aquifer-systems-mapping-148000/
- https://www.in.gov/dnr/water/ground-water-wells/water-well-record-database/database-search-help/
