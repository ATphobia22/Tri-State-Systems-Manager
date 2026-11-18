# Posey County FEMA panel 18129C0300C — DEM-assisted review screen

**Status: SOFTWARE SCREENING ONLY. NOT AN MT-1 SUBMISSION, SURVEY, FEMA DETERMINATION, OR COUNTY-WIDE LOMA ELIGIBILITY COUNT.**

## Implementation

- `tools/geospatial_exchange/posey_panel_loma_prescreen.py` runs headlessly, offline; no network or automatically fabricated BFE; uses GeoPandas and Rasterio to evaluate actual effective FEMA NFHL geometries and building footprints restricted to panel `18129C0300C`.
- `tests/geospatial_exchange/test_posey_panel_loma_prescreen.py` creates synthetic GeoJSON/raster fixtures and checks positive/negative margins, absent reviewed BFE, duplicate parcel matches, DEM nodata, vertical-datum rejection, panel-boundary clipping, blank parcel identity, and coarse DEM rejection.
- A GeoTIFF's **horizontal CRS alone does not certify its vertical datum**. Operator must supply documented `--dem-vertical-datum NAVD88` plus independently corroborated source metadata and an explicit `--dem-unit`. 1-meter USGS 3DEP products in CONUS commonly report NAVD88 vertical elevations in **meters**; verify each tile's native units before running. Do not apply GEOID18 twice.
- The raster must be <=2 m in each horizontal pixel dimension (avoids a false 1-m screen using the repository's 30-m fallback terrain). The minimum cell in a **1 meter exterior building ring** is a crude DEM adjacent-grade proxy, not a certified Lowest Adjacent Grade (LAG). The exterior ring must be **at least 99% within the DEM footprint**, and **at least 80% of selected ring pixels** must have usable non-sentinel readings, otherwise the status is `INSUFFICIENT_DEM_EVIDENCE` even when a few remaining pixels are above BFE. Coverage thresholds are conservative screening QC assumptions, not FEMA survey standards. Masked nodata/sentinel pixels never become zero. Buildings may straddle NFHL polygon or panel borders; review manually.
- All BFE values must be pre-supplied in a CSV by a human reviewer using the **effective** FIRM/FIS/official source. Do not silently copy an invalid `STATIC_BFE=-9999` or take an arbitrary cross-section whose line touches a building. The script requires `reviewed=true`, `bfe_datum=NAVD88`, a `bfe_source`, and a matching `building_id` before computing a diagnostic margin.
- The resulting status `DEM_ABOVE_BFE_REVIEW_SURVEY` is **not** `ELIGIBLE_FOR_LOMA`. A structure LOMA uses *certified natural-ground LAG*; a **whole-lot** LOMA uses *lowest lot elevation (LLE)*. Consider fill history, a documented FIS/FIRM BFE, potential LOMR-F, professional review and FEMA's sole decision authority. The `official_loma_eligible` output is always `false`.
- Panel, SFHA and building source vintages are **unverified until separately reviewed**; the receipt hashes all six local inputs and makes no claim of independent FEMA currency or scientific certification.

## Input contract

Projected, valid polygon vector files (GeoJSON/GeoPackage supported):

- `parcels`: `parcel_id`, geometry; unique match by **positive area**, not boundary-only contact.
- `buildings`: `building_id`, geometry; all building IDs unique.
- `sfha`: FEMA-effective NFHL layer 28: `DFIRM_ID`, `FLD_ZONE`, `SFHA_TF`, geometry. Filters `DFIRM_ID=18129C,FLD_ZONE=AE,SFHA_TF=T`.
- `panels`: FEMA-effective NFHL layer 3: `DFIRM_ID`, `FIRM_PAN`, geometry. Exact `FIRM_PAN=18129C0300C`.
- `dem`: local single-band GeoTIFF with a projected horizontal CRS and documented NAVD88 vertical elevations; explicit metre/US survey foot/international foot vertical unit.
- `bfe`: CSV columns `building_id,bfe_navd88_ft,bfe_source,bfe_datum,reviewed`; an empty input with headers is allowed and produces **no freeboard assertions**.

## Run

```bash
python -m pip install -r tools/geospatial_exchange/requirements.txt -r tools/geospatial_exchange/requirements-loma.txt
python tools/geospatial_exchange/posey_panel_loma_prescreen.py \
  --parcels local/posey_parcels.geojson \
  --buildings local/posey_buildings.geojson \
  --sfha local/fema_effective_28.geojson \
  --panels local/fema_effective_3.geojson \
  --dem local/3dep_navd88_1m.tif \
  --bfe local/bfe_reviewed.csv \
  --dem-vertical-datum NAVD88 --dem-unit metre \
  --panel-id 18129C0300C \
  --output /tmp/posey-panel-18129c0300c-review.csv \
  --receipt /tmp/posey-panel-18129c0300c-evidence.json
python -m pytest -q tests/geospatial_exchange/test_posey_panel_loma_prescreen.py
```

The command is an example. **Do not run it against invented paths**. Import actual FEMA source layers with `tools/geospatial_exchange/posey_nfhl_effective_geometry.py`, verify full OID/manifest/inventory integrity and review parcel/building source coverage. The output does not directly populate the existing evidence ledger or the FEMA application process. Store reviewed import receipts with hashes and source dates before treating any ranking as decision support.

## Evidence basis / correction register

- USGS OGC v1: https://api.waterdata.usgs.gov/docs/ogcapi/migration/ . TSM already has `packages/government/src/adapters/UsgsOgcV1Adapter.ts`, which validates sites/parameters, no-data flags and distinguishes stage from NAVD88. No duplicate adapter was added.
- USGS historical bulk STAC: https://api.waterdata.usgs.gov/docs/stac/ ; supported by existing `tools/geospatial_exchange/usgs_discover.py` and `usgs_download.py`.
- NOAA NWPS official API: https://water.noaa.gov/about/api . Forecasts and NWM estimates remain separate from FEMA-effective maps and gauge observations.
- FEMA 2024 MT-1 Technical Guidance: https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf . A structure uses LAG, lot uses LLE, and lidar-only evidence has its own submission criteria.
- FEMA map service: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/ . Layer 3 = panels, layer 28 = flood zones. Local authority must be reconciled with effective FIRM/FIS and LOMCs.
- USGS 3DEP unit/datum guidance: https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-usgs-digital-elevation-model . CRS cannot by itself establish source vertical datum.
- The claimed 23,082 buildings, 20,517 height-verified tiles, 1,572–2,236 SFHA structures and 106 NFIP policies were **not independently remeasured here**, and must not be represented as up-to-date certified eligibility counts. H3 indexing can accelerate tiling but an unsourced \"Grover quantum 97.8%\" accuracy claim must not enter production.

**Pending external gates:** authoritative tile/manifest availability, reviewed site-specific BFE and source reference, LiDAR accuracy at each structure, fill history, licensed survey/elevation certificate, FEMA determination, release CI and separate Windows native runtime acceptance. Human Authority Final.
