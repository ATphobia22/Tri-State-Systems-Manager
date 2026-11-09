# Mount Vernon LOD2 roof and indoor-evidence integration

**Scope:** Mount Vernon, Posey County, Indiana 47620. This implementation exports traceable roof-only OBJ candidates and assesses supplied indoor connectivity; it does **not** establish certified roof geometry, LOD3 openings, room boundaries, structural details, or safe egress.

## Source chain

- [Indiana GIO Building Footprints 2016–2020](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0): real building footprint polygons keyed by source OBJECTID.
- [Indiana GIO Road Centerlines 2024](https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0): real road centerline geometries and source identity.
- [Indiana Spatial Data Portal 2016–2020 elevation](https://gis.iu.edu/s/isdp/page/20162020elevation): public archive for LiDAR/DEM source data. A tile index alone is not downloaded point-cloud evidence.
- TSM's existing LiDAR roof-plane engine: scripts/geospatial/lod2-proof-of-concept.py and scripts/geospatial/lod2-batch-reconstruct.py, with independently inspectable Oct. 23 report in docs/validation/lod2-production-run/run-report-2026-10-23.md.

The latest government city snapshot workflow collected 7,319 building polygons and 953 road geometries in the specified Mount Vernon AOI; it does not verify their heights, roofs or indoor spaces. The existing earlier Posey County roof-plane run reports 5,256 GLBs (5,174 watertight) from 7,453 plane candidates. Source GLBs and the full input GeoJSON were **not** checked in; the new exporter does not pretend to have them.

## Why the supplied JSX prototype is not real LOD3 / LOD4

Fixed 9 m eaves, 13.5 m ridges and two floors are fabricated site measurements if used without records. A triangle fan from footprint boundary vertices to a single centroid is pyramidal and is neither a gabled nor a hipped roof solver. Holes, concavity, source CRS, Z units, absolute versus relative elevations and topology are not handled. Generating floor slabs from a story count does not produce actual rooms, exits or an evacuation network. Merely drawing a mesh does not verify its scientific fidelity.

[Overture Buildings](https://docs.overturemaps.org/schema/reference/buildings/building/) optionally supplies roof_shape, height, roof_height, num_floors and building parts, but **no value can be assumed present**, and matching to an Indiana GIO building OBJECTID requires separate identity reconciliation. [CityGML 3.0](https://docs.ogc.org/guides/20-066.html) uses LOD0–LOD3: former LOD4 interiors are now independent of geometric LoD. TSM's existing *application LOD4* is instead a flood/hydrology integration tier (docs/TSM-LOD-CONTRACT.md); do not overload it with indoor data.

## Roof-only OBJ export

The new source-gated exporter uses **existing** LiDAR-derived GLBs. It rejects missing/incorrect SHA-256, missing building OBJECTID, rejected roof-plane QC, non-watertight GLB and invalid local origin. Only upward-facing triangles are exported: the earlier prototype's fallback floor and vertical walls are excluded. No new roof styles or openings are guessed.

Requirements for local runner: Python 3.12, numpy and trimesh (pinned test versions in mount-vernon-lod-evidence.yml). Upstream Shapely and pyproj are still needed for the existing LOD2 reconstruction, but are not silently rerun by this exporter.

First produce SHA-256 checksums of the **locally available** full input files, then run:

~~~bash
sha256sum /data/posey-buildings-lod2-23082.geojson
sha256sum /data/lod2-batch-summary.json

python scripts/geospatial/mount_vernon_lod_evidence.py export-roof \
  --source-geojson /data/posey-buildings-lod2-23082.geojson \
  --source-sha256 "$SOURCE_SHA256" \
  --batch-summary /data/lod2-batch-summary.json \
  --batch-sha256 "$BATCH_SHA256" \
  --glb-root /data/lod2-glbs \
  --objectid "$SOURCE_OBJECTID" \
  --outdir /data/derived-roof-obj
~~~

The corresponding output is roof-ID.obj plus roof-ID.manifest.json, with input/output hashes, roof face count, EPSG:3857 local XY origin, an **unverified vertical datum** and explicit engineering_approved=false. Do not attach NAVD88 elevations without actual source datum and conversion metadata. A source building ID reused across dataset vintages does not prove the source geometry matches today's scene; cross-vintage identity reconciliation remains pending.

## Indoor topology gate (not evacuation routing)

Input schema: tsm.indoor.topology.v1, derived from a **documented floor plan**. Required fields are source (https URL, SHA-256, issuer, timezone-aware retrieval timestamp), building_key, EPSG:26916 horizontal coordinates in metres, floors, nodes and links. Nodes must specify their floor, XY coordinates and source SHA-256, plus one kind: ROOM, DOOR, CORRIDOR, STAIR or EXTERIOR_EXIT. Edges specify source SHA-256 and one type: DOORWAY, CORRIDOR, STAIRS, CONNECTOR.

Example *structural template only* (not actual indoor data):

~~~json
{
  "schema": "tsm.indoor.topology.v1",
  "building_key": "IGIO:building:ACTUAL_SOURCE_OBJECTID",
  "source": {
    "url": "https://source.example.invalid/record",
    "sha256": "REPLACE_WITH_64_LOWERCASE_HEX",
    "issuer": "REPLACE_WITH_REAL_ISSUER",
    "retrieved_at": "2026-11-09T08:00:00Z"
  },
  "crs": "EPSG:26916",
  "horizontal_units": "metres",
  "vertical_datum": "UNVERIFIED",
  "floors": [{"id": "F1", "elevation_m_navd88": null}],
  "nodes": [],
  "links": []
}
~~~

The placeholders above deliberately fail validation. In particular, **actual indoor nodes, links and evidence hashes must come from the source document**. No measured floor elevation can be recorded without NAVD88 source evidence. For real inputs:

~~~bash
sha256sum /data/indoor-topology.json
python scripts/geospatial/mount_vernon_lod_evidence.py assess-indoor \
  --input /data/indoor-topology.json \
  --expected-sha256 "$INPUT_SHA256" \
  --output /data/indoor-topology-assessment.json
~~~

The gate reports connected components and source-labeled exit-node count. It does **not** supply escape directions, fire-safety clearance, accessibility compliance or evacuation certification. The original floor-plan document digest is declared, **not independently compared to its original bytes** by this tool. The JSON input file is independently hashed, and that distinction is surfaced in the assessment.

## Required independent release gates

1. Re-stage original GeoJSON and per-building GLBs; verify every relevant SHA-256 and geometrical CRS.
2. Reconcile IGIO building OBJECTIDs and footprint geometries across dataset versions, and inspect candidate OBJ meshes before publishing.
3. Acquire licensed, geo-referenced architectural imagery/field measurement to establish individual façade openings; no universal LOD3 without those sources.
4. Obtain independent floor plans and vertical control for every proposed indoor network; require human professional review for operational or emergency use.
5. Verify actual imagery, terrain, tiled building meshes and each per-object provenance panel in a headed renderer.
6. Verify an independently packaged Windows 11 x64 Unreal Engine Shipping binary offline. Contract tests alone never establish this.
7. Preserve human authority final; observational and modeled data are not FEMA determinations or survey certification.

A green CI check here means only that the code gate and its synthetic tests passed. It does **not** prove that the real OBJ, LOD3 façade or indoor floor-plan evidence exists.
