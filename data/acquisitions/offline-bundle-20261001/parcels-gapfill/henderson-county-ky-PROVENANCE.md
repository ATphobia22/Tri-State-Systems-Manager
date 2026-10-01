# PROVENANCE — Henderson County, KY parcels

**Acquired:** 2026-10-01
**Authority class:** COUNTY (Henderson County, Kentucky — county's own ArcGIS Online org)
**Authority:** Henderson County KY, "HendersonKY" ArcGIS Online organization
**Service:** https://services.arcgis.com/Iwwqwcdc5CWG2jt9/arcgis/rest/services/pcls/FeatureServer/0
  (layer "pcls", esriGeometryPolygon, public access)
**Vintage:** current as retrieved 2026-10-01 (no vintage published by source)
**CRS:** EPSG:4326 (queried with outSR=4326; source extent WKID 102100/Web Mercator)
**Vertical datum:** N/A (parcel polygons — no elevation)

## Raw artifact
- `hendersonky-pcls-parcels.geojson` — 21,409,417 bytes
- SHA-256: `f2494b4f668a54b7d6e4f6f1ff700c6170f3f5271328fa5206c45cb7519e1304`
- 22,822 features (22,803 Polygon + 19 MultiPolygon), 0 missing geometry
- Service-reported count: 22,822 — download matches exactly
- Bbox: lon -87.923..-87.272, lat 37.635..37.97 (Henderson County KY)

## Privacy — public-safe by source design
The county's published `pcls` layer carries NO owner-name fields at all.
Fields: FID, PIDN (parcel number), ZONE_, ZONE_DESCR, LOCATION, ZONE_LOC,
GIS_ACRES, Shape__Area, Shape__Length. Nothing to strip; nothing stripped.

## Provenance chain
ArcGIS Online search ("Henderson County Kentucky parcels") → HendersonKY org →
"pcls" Feature Service (access: public) → layer 0 →
paged FID query (outSR=4326, f=geojson) → this file.

## Notes
- This county-direct open publication supersedes the KY DOR PVA GIS Product
  License Agreement route (one-time use / destroy-after-project) for this
  county: the county itself publishes the parcel geometry openly.
- This is the county's own publication, NOT a KY DOR statewide product and
  NOT a commercial aggregator. Labeled as county authority, never promoted.
- Reference only — not survey evidence.
