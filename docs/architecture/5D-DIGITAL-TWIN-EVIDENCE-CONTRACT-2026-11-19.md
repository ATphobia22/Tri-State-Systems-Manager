# Tri-State 5D geospatial integration contract — 2026-11-19

**Implementation status:** contract and source-discovery example only. No new native raster files, 3D tiles, regulatory feature sets, USGS live observations, or verified Windows Shipping artifacts are claimed here.

## What 5D means
Use **x/y/z position + UTC time + named scenario**. Scenario is a fifth *indexing dimension*, not a new physical coordinate or proof of a calibrated model. Evidence/provenance is a required cross-cutting plane. Keep authoritative observations, computed surfaces, hypothetical runs, forecasts and cinematic decoration distinguishable.

## Sources, purpose and limitations
- Indiana DNR DoWORC: https://www.in.gov/dnr/water/online-research-center — DNR record and floodplain research **not** a substitute for an independently checked effective FEMA panel, LOMCs and controlling BFE.
- DNR well records: https://www.in.gov/dnr/water/water-availability-use-rights/water-well-record-database/ — well locations and logs; positional precision varies by underlying record, so do not assume surveyed coordinates.
- IndianaMap: https://www.indianamap.org/search?tags=hydrogeology — hydrogeology discovery only; resolve each service/layer ID before extraction.
- Indiana state webscene: https://gisdata.in.gov/portal/home/webscene/viewer.html?webscene=0941e8e6515d4e60a3bb0252875193a1 — reference scene, not evidence of licensed offline source assets.
- Indiana GIS elevation/imagery catalogs, Illinois ISGS and Kentucky KyFromAbove should be ingested via exact eight-county polygon intersections and verified raw bytes; see issue #665 and the eight-county contract.
- USGS streamgages: use authoritative observation value, datum reference and timestamp; distinguish stale/unavailable. A stage in gauge datum must not be relabeled NAVD88 without a reviewed gauge-zero transformation.
- Cesium Sandcastle https://sandcastle.cesium.com/ is a developer sample environment; production must register known terrain providers, imagery providers and validated 3D Tiles separately. A DEM or orthophoto GeoTIFF is **not automatically** a 3D Tileset.
- OSM Taginfo https://taginfo.openstreetmap.org/keys is tag discovery; OSM data require attribution and Open Database License review. Do not scrape Google Maps assets into offline bundles; use approved APIs within their terms if ever necessary.
- Gemini, Magnific and Runway may produce illustrative material, not authoritative topography, control points, flood observations or building measurements.
- RAD Bink requires a project-specific entitlement/license decision; do not assume it is freely redistributable for this app.

## Contract files
- `contracts/schemas/tsm-5d-scene-manifest-v1.schema.json`
- `data/schemas/examples/tsm-5d-scene-manifest-v1.example.json`
- `scripts/ci/validate-5d-scene-manifest.mjs`
- `tests/contracts/5d-scene-manifest.test.mjs`

## Acceptance and sequencing
1. Discover source dataset and native feature service identifiers; record agency, URL, layer ID, source date, acquisition UTC, coverage, license and access restrictions.
2. Download legally accessible raw bytes headlessly; compute SHA-256, metadata, exact county polygon intersection, original CRS and **independent vertical datum/units/geoid provenance**. Unknown is permitted for discovery, not validation.
3. Verify authoritative parcel/building identities and imagery/terrain nodata; keep source identity denominator and all failures visible. Do not invent missing Posey buildings.
4. Register temporal version: observation UTC versus publication/ingestion UTC; persist the original observation and agency identity.
5. Produce 3D terrain/3D Tiles, render both web and native headed scenes only after each asset passes bounded geometry/LOD validation. Imagery remains a separate imagery overlay.
6. Verify controls including collapsible panels, datum labeling, stale/unavailable gauges, memorial navigation, 3D layer toggles and WebGL/device recovery.
7. Shipping must pass **on exact reviewed main SHA**, with an actual UE5.8 Windows Shipping executable, full UAT logs, SHA-256, offline fresh-device launch and headed GPU proof. Ordinary CI passing does not satisfy this.
8. Keep FEMA NFHL effective DFIRM and LOMC evidence and parcel-level BFEs separate from DNR best-available/planning layers. Human authority final; do not automatically file.

**Storage policy:** large raw and derived assets live in the authorized private geodata warehouse; public GitHub contains no private Drive identifiers, OAuth tokens or unlicensed materials. Missing proof remains `NOT_VALIDATED`.
