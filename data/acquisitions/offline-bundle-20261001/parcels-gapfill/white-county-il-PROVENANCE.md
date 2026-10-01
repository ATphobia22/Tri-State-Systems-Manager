# PROVENANCE — White County, IL parcels

**Acquired:** 2026-10-01
**Authority class:** COUNTY (White County, Illinois — official county GIS page)
**Authority:** White County IL via Sidwell/Magnasoft-hosted ArcGIS parcel service,
  linked from the county's official "GIS Online Mapping" page
  (https://whitecounty-il.gov/gis-online-mapping)
**Service:** https://services.arcgis.com/4YineAQdtmx0tv46/arcgis/rest/services/Parcels_WhiteIL2/FeatureServer/0
  (layer name "Staging", esriGeometryPolygon)
**Vintage:** current as retrieved 2026-10-01 (no vintage published by source)
**CRS:** EPSG:4326 (queried with outSR=4326; source extent WKID 102100/Web Mercator)
**Vertical datum:** N/A (parcel polygons — no elevation)

## Raw artifact
- `whiteco-il-arcgis-parcels.geojson` — 20,843,030 bytes
- SHA-256: `e123a8ad98ec6e914ff21d3dea59c5fa236f9a5ffd6e1eb85fe8ff42ef473f26`
- 20,956 features (20,943 Polygon + 13 MultiPolygon), 0 missing geometry
- Service-reported count: 20,956 — download matches exactly
- Bbox: lon -88.375..-87.91, lat 37.886..38.26 (White County IL)

## Privacy — public-safe derivative
ALL owner-name and owner-address fields were stripped at acquisition:
Primary_Owner, Secondary_Owner, Mail_To_Name, owner mailing addresses,
owner IDs, deed Document numbers, sale dates, and assessed/tax dollar amounts.
Retained: parcel numbers (PIN/ALTPin), acreage, township, city, tax code,
site address, property class, tax status, legal description.
Verified: 0 features contain any stripped field.

## Provenance chain
whitecounty-il.gov (county GIS page) → ArcGIS Experience
`f893acf6d54a4db9b4411827c18b39dd` (owner pabitra_Magnasoft) →
"Parcel Viewer" web map `0b8d4b48b76e485fa0644df93640f5b2` →
Parcels_WhiteIL2 FeatureServer/0 → paged OBJECTID query (outSR=4326, f=geojson)
→ owner-field strip → this file.

## Notes
- The Illinois ISGS clearinghouse remains unreachable from the acquisition
  network (HTTPS empty reply, curl exit 52; HTTP 301s to HTTPS which fails).
  This county-direct source replaces it for parcels.
- Reference only — not survey evidence.
