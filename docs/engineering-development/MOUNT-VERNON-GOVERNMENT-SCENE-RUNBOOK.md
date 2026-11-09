# Mount Vernon sourced city-scene vertical slice

## Status and authority
This is a georeferenced **reference** layer, not a surveyed city boundary, certified building model, independently validated heights, or a government engineering decision.

Authoritative source locations:
- IGIO building footprints 2016–2020: https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0
- IGIO road centerlines (2024 collection): https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0
- Existing TSM terrain: USGS 3DEP/Indiana GIO, separate elevation/datum evidence paths.

## Create and view

From repository root:

```bash
python3 scripts/geospatial/build_mount_vernon_scene.py \
  --bbox -88.03 37.87 -87.84 38.01 \
  --output tsm-console/public/mount-vernon-scene
cd tsm-console
npm ci
npm run dev
```

Start the established TSM twin route and select a building/road. The inspector displays the government layer's OBJECTID, a stable composite scene identity, source record URL, SHA-256 of that extracted GeoJSON feature, scene-archive SHA-256, and approval state.

The bbox is a **non-authoritative discovery AOI** (not the incorporated Mount Vernon legal boundary). Bounding box intersects may include adjacent features. The importer queries **all returned ArcGIS OBJECTIDs** in batches and aborts when any are missing; the output has **no inferred heights**. The source data may change across downloads; store each run's scene and receipt together. The receipt protects accidental corruption in transit but is **not an independently trusted signature** or pinned Merkle root. Release promotion must pin, review and sign the receipt and store original source bytes separately.

The existing MapLibre hillshade/imagery, independently configured raster DEM, optional 3D Tiles, hydraulic layers and source freshness controls remain independent. If `scene.json` or `scene.receipt.json` is absent, the inspector reports missing and the rest of the twin still renders. Never fabricate buildings to hide ingestion gaps.

## Test locally

```bash
python3 -m unittest discover -s tests -p test_mount_vernon_scene_builder.py -v
node --test tsm-console/tests/mount-vernon-city-scene-contract.test.mjs
cd tsm-console && npm run check:type
```

## Next independent acceptance gates

1. Validate the downloaded source counts, snapshots, object IDs, intersection geometry, CRS and licensing against authoritative agency metadata; archive original immutable bytes.
2. Reconcile the complete Posey County footprint set against archived 23,082 target records and the previous 22,815-height subset by **source IDs**, not counts alone.
3. Attach measured heights only after validating surface model, ground elevation, vertical transformation and accuracy.
4. Add Merkle proofs and independently pinned signed release receipts; do not infer official agency acceptance.
5. Build actual self-hosted terrain and building 3D Tiles under a verifiable geodetic transform; test in native UE5.8 Windows Shipping, offline and on a clean machine.
6. Obtain qualified professional review and applicable regulatory determinations before promoting engineering calculations.
