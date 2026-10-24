# Posey County Government Evidence Boundaries

**Contract:** `data/posey-county/government-evidence-boundaries-v1.json`  
**Scope:** Posey County source acquisition and evidence handling. This is not a site-specific AOI approval or an engineering determination.

## Required authority separation

- **Effective FEMA NFHL/FIRM:** retain the effective product identity, panel/community context, and effective date. Preliminary or pending mapping must not be represented as effective.
- **Indiana DNR Best Available Flood Hazard Mapping (BAFM):** planning/screening context only for this contract; do not label it NFIP-regulatory or use it for flood-insurance determinations. Verify current source metadata and the acquired artifact.
- **FEMA Base Level Engineering (BLE):** explicit status is **UNVERIFIED** until actual artifacts, version/provenance, coverage, geometry, and validation receipts are available. A manifest definition is not acquisition evidence.
- **USGS SIR 2016–5119:** the report describes a 3.68-mile reach of the Wabash River at New Harmony, USGS station 03378500. Its maps and calibration are reach-specific reference evidence, not transferable calibration for another site.
- **USACE ERDC/CHL TR-22-4:** the report describes a 2D Adaptive Hydraulics study of hydraulics and sediment transport at the Wabash–Ohio confluence. Its bathymetry, bed gradation, boundary conditions, and calibration cannot be inferred for a different AOI from the report alone.
- **Vertical datum:** the USGS report distinguishes gage stage on a gage-specific datum from elevations referenced to NAVD 88; its horizontal coordinates are NAD 83. Never treat gage height as NAVD 88 elevation or silently mix NGVD 29 and NAVD 88.

## Datum-conversion gate

The uploaded FEMA *Vertical Datum Conversion* guidance (May 2014) describes passive, countywide, and stream-based conversion approaches. It does not justify a universal constant offset. Before conversion or publication, require the source and target vertical datums, selected method, conversion tool/model and version, geographic applicability, factor or grid reference, units, variation/uncertainty, validation evidence, and reviewer disposition. Check applicable current standards before operational use of this 2014 guidance.

Unknown, conflicting, or missing vertical-datum semantics block promotion. Any stage-to-elevation relationship requires independently documented gage-datum metadata and validation; station altitude alone is not a gage-zero offset.

## Acquisition, validation, and publication

1. Track each source with one of `NOT_ACQUIRED`, `ACQUIRED_UNVERIFIED`, `VALIDATED`, or `PUBLISHED`.
2. Record source identity, authoritative URL, retrieval time, version/vintage, media type, byte length, SHA-256 of the acquired bytes, attribution/license, CRS, vertical datum, feature count, geometry bounds, and validation results.
3. Reconcile AOI polygon geometry, source coverage, bounds, feature counts, and NoData/empty responses. Use the authoritative county polygon for county extracts; a bounding box alone is not county containment.
4. Fail closed when a required source is missing, a required minimum count is not met, hashes differ, schema/geometry checks fail, or datum/CRS semantics are unresolved. No silent skips.
5. Write candidate outputs to staging, validate all required artifacts, then atomically publish the complete manifest and outputs. Do not promote a partially acquired manifest.
6. Keep the county research scope distinct from any parcel/site AOI. Site AOI status remains **NOT APPROVED** until the boundary, authoritative terrain/water inputs, coverage, and review evidence are verified.

## Source register

- USGS Fowler (2016), *Flood-Inundation Maps for the Wabash River at New Harmony, Indiana*, SIR 2016–5119, DOI: https://doi.org/10.3133/sir20165119
- USACE ERDC/CHL TR-22-4 (February 2022), *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation*
- FEMA, *Guidance for Flood Risk Analysis and Mapping: Vertical Datum Conversion* (May 2014)
- Indiana DNR, Indiana Floodplain Information Portal: https://infip.dnr.in.gov/
- NOAA National Geodetic Survey, datums and reference frames: https://geodesy.noaa.gov/datums/
- FEMA NFHL: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer

The documents provide context and constraints; they do not establish that current Posey County source downloads, a parcel AOI, or any new model run have been completed.


## Horizontal reference frames vs vertical datums

Keep the horizontal reference frame separate from the vertical height reference:

- **Horizontal/geometric reference:** records where a point is (latitude/longitude or projected coordinates), with the CRS, datum/reference frame, realization, epoch when applicable, coordinate units, and any transformation operation. NOAA NGS lists NAD 83 (2011), epoch 2010.00 as the current official geometric datum realization for the conterminous U.S.; historical NAD 27 and other NAD 83 realizations may still appear in older maps and datasets.
- **Vertical datum:** records the zero/reference for elevations and water depths. NOAA NGS currently lists NAVD 88 as the CONUS vertical datum, while NGVD 29 remains present in legacy products. Do not silently mix their elevations.
- **Gage datum:** local/station-specific reference for gage-height measurements. Raw stream stage is not NAVD 88 elevation, and station altitude is not a gage-zero conversion.
- **CRS identifiers are not a complete height contract:** record horizontal CRS and vertical datum/height type independently. Missing, conflicting, or unsupported datum metadata blocks promotion.

## Ellipsoid, geoid, and height conversion

![Conceptual relationship between ellipsoid height, geoid height, and orthometric height](images/geoid-ellipsoid-height.svg)

- **Ellipsoidal height (h):** GNSS height relative to a specified mathematical reference ellipsoid and compatible geometric reference frame.
- **Geoid height (N):** separation between a compatible ellipsoid and geoid model surface.
- **Orthometric height (H):** elevation relative to a named vertical datum, such as NAVD 88 in CONUS.
- NOAA NGS gives the relationship **h = H + N**, or rearranged **H ≈ h − N**. Apply this only with compatible model, reference frame/realization, epoch, supported geographic area, and consistent units. It is not a universal fixed offset.

**GEOID18 compatibility rule:** NGS specifies GEOID18 for NAD 83 (2011), epoch 2010.00 ellipsoid heights when deriving orthometric heights consistent with NAVD 88 in CONUS. It is not directly compatible with arbitrary WGS 84, ITRF, or other NAD 83 realizations. Document any needed coordinate transformation, model/software version, grid coverage, stated uncertainty, and independent control checks. The geoid model's estimated fit uncertainty is not a complete statement of overall vertical accuracy.

NGS's NAPGD2022/NATRF2022 tracking page currently marks beta public feedback as complete, but also describes these as future references and indicates that key transformation-tool capabilities are still pending. TSM must not assume the modernized NSRS is operationally adopted based only on beta milestones. Confirm formal NGS release/adoption and production tool support at the time of deployment.

## USGS TopoView and US Topo collection

- [TopoView map viewer](https://ngmdb.usgs.gov/topoview/viewer/#4/39.98/-100.02) provides historical maps and the US Topo series. Retain map edition/publication date, map identity, and source link when used.
- [USGS US Topo Map Collection metadata](https://catalog.data.gov/dataset/usgs-us-topo-map-collection) describes layered geospatial PDFs for 7.5-minute quadrangles, including contours, hydrography, orthoimagery, roads, boundaries, and geographic names. The catalog metadata page reports metadata updated **2025-03-11**, with the map data last modified **2025-02-14**. Download access is via [The National Map data delivery](https://www.usgs.gov/the-national-map-data-delivery).
- These are cartographic-reference products. Their existence in TopoView or Data.gov is not proof that TSM has downloaded them, and the rendered quadrangle map is **not a substitute for a current bare-earth DEM, LiDAR-derived terrain, surveyed bathymetry, or vertical-control evidence**.

## Authoritative geodetic sources

- NOAA NGS, [Datums and Reference Frames](https://geodesy.noaa.gov/datums/index.shtml)
- NOAA NGS, [NAD 83 horizontal/geometric datum](https://geodesy.noaa.gov/datums/horizontal/north-american-datum-1983.shtml)
- NOAA NGS, [GEOID18 technical details and compatibility](https://geodesy.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml)
- NOAA NGS, [NSRS modernization status](https://geodesy.noaa.gov/datums/newdatums/TrackOurProgress.shtml)
- USGS, [TopoView](https://ngmdb.usgs.gov/topoview/viewer/)
- Data.gov, [USGS US Topo Map Collection](https://catalog.data.gov/dataset/usgs-us-topo-map-collection)

The current data products and datum statuses must be checked at acquisition time. This contract does not approve a parcel AOI, establish local vertical control, or authorize a new hydraulic model run.
