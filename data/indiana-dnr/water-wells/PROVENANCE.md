# Provenance — Indiana DNR Water Well Records (Posey County)

## Identity

| Field | Value |
|---|---|
| Authority | Indiana Department of Natural Resources (IDNR), Division of Water |
| Source | ArcGIS FeatureServer — `https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer` |
| Query | Layer `0/query`, Posey County bbox (-88.15, 37.75, -87.85, 38.05), EPSG:4326 |
| Data class | **reference** — subsurface/hydrogeology evidence plane (well logs) |
| Acquisition script | `tools/acquisition/indiana/fetch-idnr-wells.mjs` (Node stdlib only, fail-closed, paged) |
| Output | `idnr-water-wells-posey-v1.geojson` + `.sha256` sidecar + `.receipt.json` |

## Location-quality classification — read before use

The IDNR water-well dataset (~407,000 statewide records) mixes three kinds of
locations: **field-located** (GPS/survey), **geocoded** (address-matched), and
**PLSS-estimated** (derived from township/range/section). The acquisition
script classifies every record into one of `field-located`, `geocoded`,
`plss-estimated`, or `unknown` from the service fields and stores it as the
`location_quality` property on each feature.

**Explicit warnings:**

1. **PLSS-estimated and geocoded locations are NOT survey-grade geometry.**
   They must be labeled as estimated wherever displayed, mapped, or joined.
2. **Never silently promote** an estimated well location to a survey point in
   derivatives (setbacks, buffers, floodplain overlays).
3. Unknown-quality records are `unknown` — never defaulted to field-located.

## Acquisition controls

- Fail-closed: throws and writes nothing on non-2xx HTTP, invalid JSON, or
  paging errors. Paging continues (`resultOffset`) until a short page returns.
- Every acquisition records a validation receipt JSON (source URL, HTTP
  status, retrieval timestamp, content type, feature count, SHA-256, CRS).
