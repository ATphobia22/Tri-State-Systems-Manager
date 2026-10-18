# CityGML 3.0 → 3D Tiles Pipeline

**Research basis:** mapping-planes-lod-integration-20261018-0426

Production-proven, permissively-licensed pipeline. No Cesium ion, no commercial
services — plain static files served from any web server.

## Toolchain

| Tool | License | Role |
|------|---------|------|
| 3DCityDB v5 + citydb-tool | Apache-2.0 | CityGML 3.0/2.0 → PostGIS; validation; LOD normalization |
| citygml-tools | Apache-2.0 | CLI: validate, reproject, filter-lods, to/from-cityjson, upgrade 2.0→3.0 |
| cjio | Open source (Python) | CityJSON ops incl. `lod_filter` |
| pg2b3dm | MIT | PostGIS → 3D Tiles 1.0/1.1 (b3dm/glb, implicit tiling); produced 3DBAG's 10M-building tiles |
| val3dity | Open source | ISO 19107 geometry validation |
| roofer | GPL-3.0 (external tool, do not vendor) | Point cloud → CityJSONSequence LoD1.2/1.3/2.2 |

## CityGML 3.0 LOD model

- **LOD0–LOD3 only. LOD4 was removed.** Interiors are LOD-independent:
  indoor and outdoor representations of one building may sit at different LODs.
- Refined sub-tiers **LODx.y** (Biljecki et al. 2016): 16 levels 0.0–3.3.
  Supported in CityJSON; production use in 3DBAG (LoD1.2, 1.3, 2.2) and roofer.
- citydb-tool migration flags for 2.0→3.0: `--use-lod4-as-lod3`,
  `--map-lod0-roof-edge`, `--map-lod1-surface`.

## Pipeline steps

```bash
# 1. Validate + import CityGML 3.0 into 3DCityDB v5 (normalizes LODs)
citydb-tool import -H localhost -d citydb -u postgres city-models/*.gml

# 2. (Optional) filter to one LOD family for a per-LOD layer
citygml-tools filter-lods --keep 2 input.gml -o lod2-only.gml
cjio lod_filter --keep 2.2 model.city.json

# 3. Stage per-LOD PostGIS views with a `lod` column
psql -d citydb -c "
  CREATE OR REPLACE VIEW lod_buildings AS
  SELECT b.id, b.lod::text AS lod, b.geometry AS geom
  FROM building b WHERE b.lod IN ('1','2');"

# 4. Emit static 3D Tiles (implicit tiling, per-LOD geometricError)
pg2b3dm \
  --connection "host=localhost dbname=citydb user=postgres" \
  -t lod_buildings -c geom \
  --lodcolumn lod \
  -g 1000 --geometricerrorfactor 4 \
  --use_implicit_tiling \
  -o ./tiles/
```

Serve `./tiles/` as static files. TSM's active map path is `src/components/ThreeDTilesLayer.tsx`, which uses `3d-tiles-renderer` with the MapLibre camera. Screen-space-error refinement is driven by the renderer's camera and pixel resolution; validate the selected geometric-error policy against actual camera paths.

## LOD → geometricError heuristic

No tool automates this; it is a pipeline decision. Anchor to CityGML accuracy:

| LOD | Positional accuracy | Suggested root geometricError |
|-----|--------------------|-------------------------------|
| LOD1 | ~2.0 m | hundreds of meters (coarse) |
| LOD2 | ~1.0 m | tens of meters (2 m-class) |
| LOD3 | ~0.2 m | single meters (0.5 m-class) |

Tune until refinement pops at the right camera distances. Alternatives:
one tileset with ADD refinement (parent = low LOD, children = higher LOD),
or separate implicit tilesets per LOD toggled client-side.

## LOD2 from point clouds (roofer)

roofer is GPL-3.0 copyleft — use as an **external tool**, never vendored.

```bash
roofer --input pointcloud.las --output buildings.city.jsonl \
  --lod 2.2 --crs EPSG:2968
```

## Headless PBR baking (Blender)

Blender is GPL as a tool; baked output assets are unrestricted. One background
worker per map (UI-blocking calls avoided); parent enforces timeouts.

```bash
blender -b --factory-startup scene.blend --python scripts/3d-tiles/bake-pbr.py \
  -- --map normal --out ./baked/
```

See `scripts/3d-tiles/bake-pbr.py`. Then:

```bash
# Optimize + atlas: glTF-Transform (MIT) — explicit CI tooling, not app dependency
TSM_INSTALL_EXTERNAL_TOOLING=true node scripts/ci/install-external-tooling.mjs
./tsm-console/node_modules/.bin/gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp
./tsm-console/node_modules/.bin/gltf-transform join lod2-*.glb merged.glb
```

UV atlasing: xatlas (check repo LICENSE before use). Atlas sub-regions are
addressed per-material via `KHR_texture_transform` UV offset/scale.

## Honest gaps

- **LOD3 from aerial data:** no good open-source solution (R&D gap).
- **AI LOD2:** production LOD2 is classical geometry (roofer); no turnkey AI generator.
- **5D state-word framework:** TSM has a pure scheduling planner in `src/lib/state-word-scheduler.ts` and bit-layout helpers in `src/lib/state-word.ts`. The planner is not yet connected to `EXT_structural_metadata`, resource fetch/release operations, or GPU attributes; treat it as a prototype, not an operational scheduler.
- **WebGPU volumetric terrain:** no browser library; use canvas flood-fill for
  near-term flood visualization.
- **MapLibre-native IBL:** does not exist; PBR/IBL requires the Three.js
  custom-layer path (`src/lib/pbr-ibl-setup.ts`).
