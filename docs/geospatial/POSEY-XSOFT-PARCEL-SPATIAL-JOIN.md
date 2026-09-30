# Posey XSoft parcel -> floodplain -> terrain spatial join

Verified live 2026-09-30. Implementation:
`backend/geospatial/posey/parcel_flood_join.py` (stdlib only, fail-closed),
tests in `backend/tests/test_posey_parcel_flood_join.py` (9/9 passing),
worked evidence in
`data/posey-county/evidence/parcel-65-27-08-130-051600-018-join-v1.json`.

## 1. XSoft backend — confirmed

Posey County's XSoft Engage application
(`https://engage.xsoftinc.com/posey`, signed March 2023) is backed by:

```
https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/Posey_Parcels_(Public)/FeatureServer/0
```

identifier field: **StateCombi**. XSoft's own map JavaScript queries
`StateCombi = '<id>'` with the parcel number normalized (formatting
characters removed): `65-27-08-130-051.600-018` -> `652708130051600018`.
The service returns a real parcel polygon in EPSG:4326. This is a
confirmed application data path, not an inference.

Only non-personal identifier/geometry fields are requested
(`StateCombi,Parcel,ParcelID,CALC_ACRES,Section,Township,Range`).
Owner name/address fields are never fetched.

## 2. Indiana DNR spatial join — executed

The parcel centroid was submitted to the Indiana Best Available Flood
Hazard Layer
(`Hosted/FLOODHAZARD_DNR_WATER_PROD/FeatureServer/0`) as an INTERSECTS
query. Live result for parcel 65-27-08-130-051.600-018:

| Field          | Result                      |
|----------------|-----------------------------|
| DFIRM_ID       | 18129C                      |
| Flood zone     | X                           |
| Zone subtype   | AREA OF MINIMAL FLOOD HAZARD|
| SFHA           | F                           |
| DNR source     | NFHL                        |
| Source citation| 18129C_FIRM1                |

The joined feature identifies itself as NFHL-sourced. DNR describes Best
Available mapping as a separate state product, not a replacement for the
FEMA NFIP product. Static BFE / depth / velocity are nodata (-9999).

## 3. USGS 3DEP terrain — executed

Parcel centroid (area-weighted, EPSG:4326) sampled against the USGS
Elevation Point Query Service (`epqs.nationalmap.gov/v1/json`):

* Elevation: 120.179 m (394.29 ft), NAVD88 — interpolated from the 3DEP
  dynamic elevation service; accuracy varies with source data
* Resolution: 1 m, raster 113780

## 4. FEMA NFHL — fail-closed, not fabricated

The FEMA NFHL REST endpoint (`hazards.fema.gov`) is intermittently
unreachable from this environment. The parcel-specific FIRM panel is
therefore recorded as UNAVAILABLE — never fabricated. The DNR join
establishes DFIRM_ID=18129C with source_dnr=NFHL, but that does not by
itself establish which FIRM panel the parcel lies on.

## Evidence object

`build_parcel_flood_evidence()` returns a `tsm.posey.parcel-flood-join/v1`
object: source observations with per-step status, provenance URLs, and
retrieval timestamps. It produces no BFE determination, no flood-insurance
conclusion, no HEC-RAS result, and no engineering certification. The object
is structured so HEC-RAS geometry/results, terrain surfaces, WSE/depth/
velocity, uncertainty, and provenance can attach later without collapsing
FEMA, DNR, USGS, county assessment, and derived engineering evidence into
one undifferentiated layer.
