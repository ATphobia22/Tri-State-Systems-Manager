# Government Downloads Manifest

Downloaded: 2026-10-18
Purpose: Tri-State Systems Manager — Posey County, IN (FIPS 18129) and neighboring counties

## Successfully Downloaded

### Indiana DNR Best Available Floodplain Mapping (BAFM)

Source: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/

| File | County | Size | SHA-256 |
|------|--------|------|---------|
| BAFM-Posey-County-IN.zip | Posey | 75 MB | `dd1f4904cf1d3ceeb2b0c1acc835352ab845aa74ae6f0f9c0ca11e5d7feec5df` |
| BAFM-Vanderburgh-County-IN.zip | Vanderburgh | 50 MB | `7b0cd25e75cac9f4fa0a56c7bf83598c4459966b4030d848143aa438d90f4a65` |
| BAFM-Gibson-County-IN.zip | Gibson | 92 MB | `8a205de1d7db158535c45c9929923ca2bb170ed95e7bb8476b320c51b02f7889` |
| BAFM-Warrick-County-IN.zip | Warrick | 88 MB | `61f7d64818615264356f44f874b6d4d8ed05ac12a5210168401773b760842ed6` |

**Contents (each ZIP):**
- `FloodHazard_BestAvai_DNR_Water.shp` — Best Available flood hazard polygons
- `Flood_Elevation_Pts_DNR_Water.shp` — Flood elevation points (50-ft spacing along stream centerlines for BFE determination)
- `ReadMe.pdf` — Documentation
- Symbology files (.lyr, PDF)

**Authority:** Indiana DNR Division of Water
**Vintage:** 2026-09-30 (file dates in ZIP)
**Status:** OBSERVED (government-published)

## Failed / Blocked Downloads

### FEMA FIS Report (18129CV000A)
- **URL:** https://msc.fema.gov/portal/downloadProduct?productTypeID=FINAL_PRODUCT&productSubTypeID=FIS_REPORT&productID=18129CV000A
- **Status:** FAILED — msc.fema.gov blocked by VM egress proxy (curl exit 52, empty reply)
- **Workaround:** Parent agent downloaded via browser task (407 KB, 28 pages). Floodway Data Table extracted and saved as `../flood-cross-sections/FIS-18129CV000A-Table9-Floodway-Data.csv`

### FEMA FIRM Panels (18129C0265C, 18129C0300C)
- **Status:** FAILED — Same msc.fema.gov block
- **Note:** Panel numbers confirmed from project records; download requires browser or unproxied network

### USGS 3DEP 1m DEM
- **Status:** SKIPPED — Repo already has adequate DEM coverage:
  - `data/fabrics/downloads/indiana-dem-2020/posey-dem-2020-2k.tif`
  - `data/fabrics/downloads/usgs-3dep-1m/` (5×50MB chunks)
  - `data/posey-county/elevation/in2020-26850945-12-dem-2.5ft.tif`
- USGS 3DEP S3 (prd-tnm.s3.amazonaws.com) is accessible but re-download is redundant

### USACE NLD Levee Data
- **Status:** SKIPPED — Repo already has:
  - `data/fabrics/downloads/nld/indiana-leveed-areas.geojson`
  - `data/usace-nld/leveed-areas-wabash-v1.geojson`
  - (104 leveed areas per project records)

### OpenFEMA API
- **Status:** FAILED — api.fema.gov returns empty through VM proxy

## Summary

- **Downloaded:** 4 files, 305 MB total (Indiana DNR BAFM for all 4 Indiana counties in project area)
- **Failed (blocked):** FEMA MSC downloads (FIS, FIRM panels)
- **Skipped (already in repo):** USGS 3DEP DEM, USACE NLD
- **All downloads from .gov domains or official state websites**
