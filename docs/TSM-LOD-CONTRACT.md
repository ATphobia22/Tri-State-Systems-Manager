# TSM Application LOD Contract v1

**Date:** 2026-10-02
**Machine contract:** `contracts/tsm-lod-contract-v1.json`
**Schema version:** `TSM-LOD-Contract-1.0`

## What this is

This contract defines Levels of Detail (LOD) for the Tri-State Systems Manager
digital twin **at the application level**: what data each twin object carries,
what provenance it must have, and what computation produces it.

It is **not** CityGML. CityGML LOD4 means interior rooms and furniture — that
scope is explicitly out of TSM. TSM targets LOD1/LOD2 because flood work needs
parcel geometry + structure height + ground elevation, not floor plans.

**Governing axiom:** Technology informs people; it does not silently govern
people. Human authority remains final.

## Level summary

| Level | Name | What it is | Status |
|---|---|---|---|
| LOD1 | Parcel blocks | Parcel polygons extruded to estimated height, seated on terrain | **Production target (current)** |
| LOD2 | Building shapes | LOD1 + LiDAR footprints + height estimates + approximate roof form | Planned (inputs partially in-hand) |
| LOD3 | Detailed structures | Openings, textures — only where source data exists | Future (data-gated) |
| LOD4 | Application integration | Geometry fused with flood WSE + hydrology + explicit uncertainty | Future (depends on LOD1–3 + hydrology) |

**Lower levels are valid and useful.** LOD1 is the current production target, not
a stepping stone to apologize for. Each LOD is a complete, useful product.

---

## LOD1 — Parcel blocks (production target)

2D parcel polygons extruded to an estimated structure height, seated on terrain.
Sufficient for per-parcel flood exposure screening.

**Required inputs:**
- Parcel geometry: `tsm-console/public/data/posey-parcels.geojson` (4,121 features,
  PROVISIONAL). Unavailable → parcel excluded from LOD1 set, recorded in manifest.
- Terrain DEM: USGS 3DEP-derived Terrain-RGB tileset (z8–z12, 478 tiles), DERIVED.
  Unavailable → ground elevation unavailable; no extrusion performed.

**Derivation (parcel → terrain → building):**
1. Sample terrain elevation at parcel centroid (building-ground elevation sampling).
2. Estimate structure height: fixed default (e.g. single-story 10 ft) unless a
   verified height attribute exists. Estimated heights are labeled ESTIMATED,
   never stated as measured.
3. Extrude parcel polygon to estimated height; seat base at sampled ground elevation.
4. Emit glTF 2.0 GLB per tile region; register in OGC 3D Tiles 1.1 tileset.

**Output:** OGC 3D Tiles 1.1 tileset of GLBs. Per object: `parcelId`
(sourceObjectId), `groundElevationFtNavd88` (or null), `extrusionHeightFt`
(ESTIMATED unless sourced), `firstFloorElevationFtNavd88` (estimated; null if
unknown), `lodLevel: 1`, `provenanceHash`.

**Accuracy/uncertainty:** Terrain as-sourced (3DEP QL2 RMSEz ≤ 0.33 ft
non-vegetated). Extrusion height is an ESTIMATE with no stated accuracy unless
sourced. Uncertainty recorded per object with `confidence: SCREENING`.

**Complete means:** Every parcel with available geometry AND terrain has an
extruded block; parcels missing either input are listed as unavailable in the
manifest. No invented geometry exists in the tileset.

**Not claimed:** Roof form, openings, textures, interior. Per-parcel BFE.
Certified elevations.

---

## LOD2 — Building shapes (planned)

LOD1 extended with LiDAR-derived building footprints and height estimates, plus
approximate roof-form geometry. Improves flood-depth-per-structure estimates.

**Required inputs:** LOD1 tileset + manifest (fail closed without it);
LiDAR-derived building footprints (**not yet in-hand** for Posey County);
height estimates via LiDAR first-return / DSM–DTM differencing (**not yet in-hand**).

**Derivation:** Intersect LiDAR footprints with LOD1 parcel blocks (many-to-one
allowed; orphans recorded). Roof form from height distribution: flat / gable /
hip approximation ONLY — no dormers, no chimneys. Roof form is approximate
classification, not surveyed geometry.

**Output:** Separate OGC 3D Tiles 1.1 tileset. Per object: all LOD1 attributes
plus `buildingFootprintId`, `roofForm` (flat|gable|hip|unknown, APPROXIMATE),
`eaveHeightFtNavd88`, `ridgeHeightFtNavd88` (estimated), `lodLevel: 2`.

**Complete means:** Every LOD1 object with an available footprint + height
estimate carries LOD2 geometry; objects without remain at LOD1 with the gap
recorded. No footprint is invented where LiDAR shows none.

**Not claimed:** Openings, textures, materials, interiors. Survey-grade roof geometry.

---

## LOD3 — Detailed structures (future, data-gated)

Individual building models with openings (doors/windows) and texture where source
imagery exists. Produced ONLY where supporting data exists — never extrapolated
to unsurveyed structures.

**Required inputs:** LOD2 tileset; georeferenced oblique/ground imagery
(**not yet in-hand**); field survey / measured drawings where available
(**not yet in-hand**).

**Output:** glTF 2.0 GLB with PBR materials where imagery exists. Per object:
openings as annotated geometry (`verified: bool` per opening), `textureSource`
(imagery capture id or null), `lodLevel: 3`.

**Complete means:** LOD3 exists only for structures with supporting data. The
manifest lists every LOD2 object and its LOD3 status (PRESENT | DATA_GAP).
A sparse LOD3 set is a correct LOD3 set.

**Not claimed:** Interiors (CityGML LOD4 scope — explicitly out of TSM scope).
As-built certification. Universal coverage.

---

## LOD4 — Application integration (future)

Operational digital twin objects: LOD1–3 geometry fused with flood simulation
results, sensor/hydrology data, and explicit uncertainty/provenance state. This
is the level at which the twin answers "how deep at this structure" — with
quantified uncertainty, not a single magic number.

**Required inputs:**
- LOD geometry: highest available LOD tileset per object (LOD1 minimum). Fail
  closed without geometry.
- Flood WSE: validated water-surface elevation — 2D hydraulic model output OR
  gage-derived WSE with datum conversion. Gage zero 352.67 ft NAVD88 for USGS
  03378500 per USGS SIR 2016-5119. **Discharge-to-WSE conversion without a
  validated rating is prohibited.** If WSE unavailable → depth not computed;
  object shows geometry only with "no WSE" state.
- Hydrology snapshot: user-triggered USGS snapshot (13-station registry), no
  automatic polling. Stale values shown with timestamp, never as live.

**Derivation (flood-WSE → building/parcel-depth):**
```
depthFt = wseFtNavd88 − groundElevationFtNavd88
```
If either term is unavailable, depth is UNAVAILABLE (never zero by default).
Attach explicit uncertainty/provenance state per object.

**Output:** Per object: `groundElevationFtNavd88` + source + confidence,
`wseFtNavd88` + source + timestamp + validation status, `floodDepthFt` (or
null = UNAVAILABLE), `depthUncertaintyFt` (quantified where possible),
`provenanceState: COMPLETE | PARTIAL | UNAVAILABLE`,
`humanAuthorityGate` (required for any operational decision use).

**Complete means:** Every LOD1+ object carries a LOD4 record: geometry
reference, depth (or explicit UNAVAILABLE), uncertainty, and provenance state.
"Complete" includes complete honesty about gaps.

**Not claimed:** Regulatory determinations (BFE, LOMA outcomes). Real-time
state (snapshot-only by policy). Survey-certified elevations (unless
independently certified).

---

## Provenance requirements

Every input: source URL or asset ID, retrieval date, CRS, vertical datum (where
elevation-bearing), SHA-256 content hash.

Every object: `lodLevel`, `provenanceHash` chaining to run + inputs.

Every derivation run: software name + version, run timestamp, input manifest
hash, output manifest hash. Deterministic: same inputs + same software version
= byte-identical outputs.

## Global rules

- **Fail closed.** If a required input is unavailable, the object is emitted at
  the highest LOD its available inputs support, with the shortfall recorded.
  Never emit a higher LOD than the inputs justify.
- **Missing means unavailable.** Never zero, never interpolated, never invented.
- **No provenance laundering.** Provisional/draft/derived data is never promoted
  to authoritative. Authority classes: AUTHORITATIVE, DERIVED, SCREENING,
  PROVISIONAL.
- **Lower levels are valid.** Each LOD is complete and useful on its own.

## Reference frames

- Engineering CRS: EPSG:2966 (NAD83 / Indiana West, ftUS)
- Display: EPSG:4326 → EPSG:3857 (Web Mercator)
- Vertical datum: NAVD88, units ft
- Site anchor: 37.845887, −88.005075
- Point Township target BFE: 375.0 ft NAVD88 (target value, not per-parcel verified)
- LAG 377.20 ft is owner-supplied, not survey-certified

## Safety boundary

LOD outputs are screening/engineering-support products. They never substitute
for FEMA effective regulatory mapping, survey-certified elevations, HEC-RAS
hydraulic results used for design, or professional engineering determinations.
A visualization is never evidence.

---

*Companion to `contracts/tsm-lod-contract-v1.json`. 2026-10-02.*
