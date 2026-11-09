# Mount Vernon — Runnable Government Geometry City Scene (v1)

**Implementation status:** government data acquisition, source-object preservation, archive SHA-256, MapLibre rendering/inspection implemented in source. Actual agency data not bundled or certified. All building roof heights remain **unknown**. Terrain is provided by the existing TSM map and 3D Tiles implementation; *terrain and its vertical reference need separate QA*.

## What this vertical slice does

- Queries the Indiana GIO official [Building Footprints 2016–2020](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) and [Road Centerlines 2024](https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0), with a bounded Mount Vernon discovery AOI in EPSG:4326.
- Enumerates all official object IDs within the AOI before bounded 250-object GeoJSON query batches, checks complete coverage with stable agency source ID `IGIO:{building|road}:{objectid}`.
- Emits `scene.json` with source URLs, raw HTTP response SHA-256 receipts, source feature digests, original source CRS identifiers, acquisition year and no approval claims; emits a digest-bound `scene.receipt.json`.
- Reuses the **existing** TSM MapLibre orthophotography and 3DEP hillshade/terrain layers and adds clickable *2D footprints* and road centerlines when the scene archive is staged.
- Inspector displays identity, source link, feature hash and scene receipt digest without unsafe HTML, no guessed building stories/heights, and a plain statement that geometry is not a survey or approved engineering design.
- If the archive or WebCrypto is unavailable or checksum invalid, only this optional layer degrades. The main map/twin remains usable.

## Build a scene on a networked developer host

```bash
# Python 3.11+ (stdlib for the actual acquisition; pytest for tests)
python -m pytest -q backend/tests/test_mount_vernon_scene.py
python scripts/geospatial/build_mount_vernon_scene.py \
  --output tsm-console/public/mount-vernon-scene
# Expected files: scene.json, scene.receipt.json
cd tsm-console
npm ci
npx vitest run tests/mount-vernon-city-scene.test.ts
npm run check:type
npm run build
```

**CI:** workflow `.github/workflows/mount-vernon-official-city-scene.yml` acquires live agency reference geometry into a **temporary GitHub artifact** after tests. The artifact is not committed, not automatically included in releases, and is not a vetted current city geodatabase. The workflow has no cloud credentials and does not provision AWS resources.

To display the archive, place those exact two generated files under `tsm-console/public/mount-vernon-scene/` **before** running the viewer build. No live browser calls to the ArcGIS backend are needed after staging. An immutable offline distribution must package the two files and validate their checksums in the installer manifest.

## Evidence limits / pending implementation

- The default AOI `[-88.03,37.87,-87.84,38.01]` is a discovery rectangle and **not** the legal municipal boundary of Mount Vernon. Acquire/clip the official corporation boundary and verify it.
- Official `objectid` provides a government-record identity **within a specific layer/version**, not a persistent parcel number or guarantee across republications. Cross-version reconciliation remains pending.
- The LiDAR-derived building footprints have no measured roof heights in the selected layer; the viewer intentionally does not extrude them. Join only the independently proven TSM building-height source and explicit datum/identity evidence on stable reviewed joins.
- The city snapshot has raw response byte hashes, feature identity and a reproducible archive receipt, but no independently authenticated agency-signed source archive. Do not declare its field accuracy or survey suitability verified.
- A separate native UE5.8 World Partition/Shipping and a full offline Windows 11 release, full data rights, geoid elevation conversion, complete 23,082 Posey footprint reconciliation and calibrated hydraulic model remain outside this slice.
- No personal property-owner fields are exported; selected road labels are limited to street names. Do not repurpose arbitrary source properties to show residents or other private metadata.
