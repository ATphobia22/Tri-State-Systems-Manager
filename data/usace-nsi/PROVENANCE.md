# Provenance — USACE National Structure Inventory (NSI), Posey County IN

## Identity

| Field | Value |
|---|---|
| Authority | USACE (U.S. Army Corps of Engineers) |
| Source | National Structure Inventory (NSI) API — `https://nsi.sec.usace.army.mil/nsiapi/structures?fips=18129&fmt=fc` |
| County | Posey County, Indiana (FIPS 18129) |
| Data class | **reference** — consequence/structure context only |
| Acquisition script | `tools/acquisition/usace/fetch-nsi-structures.mjs` (Node stdlib only, fail-closed) |
| Output | `nsi-posey-in-18129-v1.geojson` + `.sha256` sidecar + `.receipt.json` |

## What this data is

NSI is a nationwide, structure-level inventory published by USACE for flood
risk and emergency-management consequence analysis. Each record describes one
structure: location (point), building type, occupancy, square footage, modeled
replacement values, FEMA flood zone label, and a modeled ground elevation.

## Explicit warnings — read before use

1. **NSI attributes are modeled/estimated per USACE documentation.** Structure
   values, building types, occupancy classifications, ground elevations, and
   population estimates are derived from national datasets and models. They
   are **NOT survey truth**.
2. **NOT regulatory.** NSI data does not establish flood zones, base flood
   elevations (BFEs), or NFIP insurance ratings. Only FEMA products (FIRM,
   FIS, LOMA/LOMR determinations) are authoritative for those purposes.
3. **Ground elevations are estimates.** `ground_elv` (feet) / `grnd_elv_m`
   (meters) are USACE-modeled values from national elevation datasets — never
   a substitute for a licensed survey (e.g. an Elevation Certificate), USGS
   3DEP terrain, or any certified elevation source.
4. **Authority-class labeling applies.** When NSI is combined with other
   sources (FEMA NFHL, IN DNR BAFM, USGS 3DEP, certified surveys), every
   derivative must keep the authority class of each source labeled. NSI values
   must never be silently promoted to survey or regulatory authority.

## Acquisition controls

- Fail-closed script: throws and writes nothing on non-2xx HTTP, invalid
  JSON, missing/empty `features` array, malformed features, or any feature
  missing a required property key (`bid`, `bldgtype`, `firmzone`,
  `ground_elv`, `grnd_elv_m`, `occtype`, `sqft`, `val_struct`, `x`, `y`).
- Streaming byte counting with a 50 MB hard cap and a 120 s timeout.
- Every acquisition records a validation receipt JSON (source URL, HTTP
  status, retrieval timestamp, content type, feature count, SHA-256, CRS and
  datum notes) alongside the payload.
