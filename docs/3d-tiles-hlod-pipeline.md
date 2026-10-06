# TSM 3D Tiles HLOD Streaming Pipeline

## Pipeline Overview

```
GLB/glTF (4,121 buildings)
  ↓
Spatial Partitioning / HLOD (quadtree, 115 nodes, depth 6)
  ↓
3D Tiles 1.1 (hierarchical tileset.json)
  ↓
Tile-level Streaming (HTTP, frustum-culled, LOD-selected)
  ↓
Three.js / CesiumJS / Unreal Engine
```

## Stage 1: GLB/glTF Input

**Source:** `scripts/geospatial/build-building-3d-tiles.py`
- 4,121 LOD1 building models (extruded prisms from parcel polygons)
- Deterministic generation: same input → same output bytes
- Each GLB in tile-local ENU frame
- Flood screening colors baked in (blue=touched, gray=dry)

**Location:** `tsm-console/public/3d-tiles/buildings/*.glb` (git-ignored, build artifact)

## Stage 2: Spatial Partitioning / HLOD

**Script:** `scripts/geospatial/build-hlod-tileset.py`

Builds a quadtree over the building centroids:
- Max 50 buildings per leaf node
- Max depth 6 (current: 115 intermediate nodes)
- Geometric error: 1000 / 2^depth (halves each level)
- Refine mode: ADD (additive — buildings appear as you zoom)

**Why HLOD:** The flat tileset (4,121 children under root) forces the client
to evaluate every tile. The HLOD hierarchy enables frustum culling —
entire subtrees are skipped when outside the view frustum.

## Stage 3: 3D Tiles 1.1

**Output:** `tsm-console/public/3d-tiles/buildings/tileset.json`

OGC 3D Tiles 1.1 compliant:
- `asset.version`: "1.1"
- Hierarchical `boundingVolume.box` (oriented bounding boxes)
- `geometricError` for LOD selection
- `refine: "ADD"` for additive refinement
- `content.uri` pointing to individual GLBs

## Stage 4: Tile-level Streaming

The client (Three.js/Cesium/Unreal) streams tiles on demand:
1. Start at root, check bounding volume against view frustum
2. If visible and geometric error > screen-space threshold, descend
3. Fetch child tile GLBs via HTTP (parallel, HTTP/2 multiplexed)
4. Render; cull when out of view or below error threshold

**Bandwidth:** Only visible tiles are fetched. A typical view loads <100 of 4,121 buildings.

## Stage 5: Renderer Integration

### Three.js (current)
**Component:** `tsm-console/src/components/ThreeDTilesLayer.tsx`
- Uses `3d-tiles-renderer` (MIT, no token required)
- Synchronized with MapLibre camera
- Fail-closed: reports unavailable if tileset unreachable

### CesiumJS
The tileset is standard 3D Tiles 1.1 — load via:
```javascript
const tileset = await Cesium.Cesium3DTileset.fromUrl('https://host/3d-tiles/buildings/tileset.json');
viewer.scene.primitives.add(tileset);
```
No Cesium ion token required for self-hosted tilesets.

### Unreal Engine
Use **Cesium for Unreal** plugin (open source):
1. Add Cesium3DTileset actor
2. Set URL to tileset.json
3. Self-hosted — no ion token needed

## Deployment

### GitHub Pages (current)
The `tsm-console/public/3d-tiles/` directory is copied to `dist/` during build.
**Note:** Currently git-ignored. To deploy:
1. Remove from `.gitignore`, OR
2. Generate during CI (recommended — deterministic build)

### AWS S3 + CloudFront (for "aws project server")
```bash
# Upload tileset and GLBs
aws s3 sync tsm-console/public/3d-tiles/ s3://your-bucket/3d-tiles/ \
  --profile ATphobia22 --region us-east-1

# Serve with correct MIME types:
#   .json → application/json
#   .glb → model/gltf-binary
```
Then point the renderer at `https://your-cloudfront-url/3d-tiles/buildings/tileset.json`.

### Local Development
```bash
cd tsm-console/public
python3 -m http.server 8000
# Tileset at http://localhost:8000/3d-tiles/buildings/tileset.json
```

## Verification

```bash
# Validate tileset structure
python3 -c "
import json
with open('tsm-console/public/3d-tiles/buildings/tileset.json') as f:
    ts = json.load(f)
assert ts['asset']['version'] == '1.1'
print('Valid 3D Tiles 1.1')
"

# Count reachable buildings
python3 scripts/geospatial/validate-terrain-3d-tiles.py
```
