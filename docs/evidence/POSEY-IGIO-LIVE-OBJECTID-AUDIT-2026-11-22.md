# Posey County official building footprint inventory — 2026-11-22

## Authority and observation

Source: Indiana Geographic Information Office, **Indiana Building Footprints 2016–2020**, ArcGIS FeatureServer layer 0.

- Layer: https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0
- Layer item ID: `384f2d5041a14c34bd9e807c568784da`
- Exact official identity request: `https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0/query?where=county%3D%27Posey%27&returnIdsOnly=true&f=json`
- Count-only request: `https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0/query?where=county%3D%27Posey%27&returnCountOnly=true&f=pjson`
- Checked: November 22, 2026 UTC (live HTTPS query)
- Count endpoint: **23,082**
- Identity endpoint: **23,082 records**, **23,082 unique positive integers**, `objectIdFieldName=objectid`
- Minimum and maximum source ID: **740296** and **763377**
- SHA-256 of the sorted IDs as UTF-8 `json.dumps(sorted(ids), separators=(',', ':'))`:
  `a08720c53cad6cd3c349e73eaa982b613b8bc7594644c7a57a66d03395677d56`
- FeatureServer `maxRecordCount`: **2,000**. The identity-only request is not limited to geometry pages.
- Layer geometry: Polygon, EPSG:3857 server source, `hasZ=false`; request `outSR=4326` when acquiring actual polygon rings.
- Metadata `editingInfo.lastEditDate`: `1776627426353` (provider timestamp, not a verified survey acquisition date).

The count-only and ID-only requests alone do not establish polygon equivalence; a separate full comparison is recorded below. They do not establish LiDAR roof heights, vertical datum, survey quality or regulatory acceptance. Do not substitute 2025 imagery-derived Tier 1 footprints, Microsoft, or Overture as if they were this layer.

## Exact identity query reproduction

```python
import hashlib, json
from urllib.parse import urlencode
from urllib.request import urlopen

base = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0/query"
url = base + "?" + urlencode({"where": "county='Posey'", "returnIdsOnly": "true", "f": "json"})
with urlopen(url, timeout=45) as response:
    data = json.load(response)
ids = data["objectIds"]
assert data["objectIdFieldName"].lower() == "objectid"
assert len(ids) == len(set(ids)) == 23082
assert all(type(i) is int and i > 0 for i in ids)
print(hashlib.sha256(json.dumps(sorted(ids), separators=(",", ":")).encode()).hexdigest())
```

The digest is an **inventory identity check**, not a geometry or certification digest. If a future snapshot differs, record source-service revision and exact added/deleted IDs; preserve the previous hash rather than overwriting it.

## Reconciliation defect repaired in companion patch

The acquisition tool outputs `properties.igioObjectId` while `reconcile_posey_building_inventories.py` only recognized `OBJECTID`/`objectid`. The latter previously marked all canonical acquisition IDs missing. This patch accepts the three unambiguous IGIO aliases while rejecting conflicting values, bools and malformed declared CRS metadata. Exact geometry comparison remains literal canonical JSON: it does not claim tolerance-based topological equivalence or a datum transformation.

## Scientific boundaries and next gates

1. Download the 23,082 actual live polygon features via disjoint OBJECTID partitions, record per-feature geometry digests and compare to the pinned release; never replace the verified snapshot merely because counts match.
2. Rerun per-footprint ground and roof LiDAR sampling with source-specific CRS, vertical units, collection date, point classes and quality flags. The 2016–2020 footprint geometry and a 2013 EPT height source have different capture periods; compare rather than assume equivalence.
3. Reconcile the known missing-height objects from the **Building 3D Tiles** gate. Keep missing geometry and height data visible as missing; don't pad heights or reduce the 23,082 source inventory to claim green.
4. Validate generated 3D Tiles/GLBs with an OGC-compatible validator, then prove WebGL Cesium headed runtime and native Windows 11 offline UE5.8 separately.

Official references: [IGIO footprint layer](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0); [IGIO source metadata](https://www.arcgis.com/sharing/rest/content/items/384f2d5041a14c34bd9e807c568784da/info/metadata/metadata.xml?format=default&output=html); [USGS 3DEP LiDAR Base Specification](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online).

## Independent full source-geometry comparison (2026-11-22)

Retrieved the archived project release directly from GitHub, independently hashed its **13,652,166 bytes**, and verified its exact pinned SHA-256: `d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f`. The archive contains 23,082 unique positive integer `objectid` values. Its sorted-id SHA-256 equals the live official source digest shown above.

Queried the authoritative FeatureServer `/query` endpoint in **47 disjoint batches** of at most 500 `objectIds`, requesting `outFields=objectid,county,lidaryear`, `returnGeometry=true`, `outSR=4326`, and `f=geojson`. Compared each returned GeoJSON `geometry` directly against the pinned archive by `objectid`, along with the `county` and `lidaryear` values.

Results: **23,082/23,082 exact coordinate-and-geometry JSON matches**; no missing, extra, or duplicate OBJECTIDs; **0** changed geometry features, **0** source-year differences, **0** county differences, and **0** request errors. The source contained **23,071 Polygon** and **11 MultiPolygon** features. The layer-reported edit timestamp was **1776627426353 ms** (2026-04-19T19:37:06.353Z); this is *not* proof of the lidar acquisition date.

**Scope:** Source geometry/ID/compared-attribute equivalence only. This does **not** independently certify ground or roof heights, geoid/vertical reference, survey accuracy, regulatory suitability, LOD2/LOD3 mesh validity, or UE Shipping deployment. The known Building 3D Tiles acceptance blocker is downstream of source footprint acquisition and remains open.
