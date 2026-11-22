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

These observations **do not** prove that the 2026 live layer is byte-identical, topologically identical, or source-vintage-equivalent to TSM's pinned October 2026 23,082-feature GeoJSON. They do not establish LiDAR roof heights, vertical datum, survey quality or regulatory acceptance. Do not substitute 2025 imagery-derived Tier 1 footprints, Microsoft, or Overture as if they were this layer.

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
