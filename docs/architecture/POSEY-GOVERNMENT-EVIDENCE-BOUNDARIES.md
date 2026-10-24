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
