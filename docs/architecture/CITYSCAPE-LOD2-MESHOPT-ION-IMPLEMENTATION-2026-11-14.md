# Cityscape LOD2 + meshopt + Cesium ion — Concrete Implementation (2026-11-14)

## Blockers first
1. Mark ready and merge **#580** (COPC multipart roofs) and **#581** (DEM staging).  
2. Optional: **#577** UE5.8 HLOD/Cesium pin.

## Step A — Heights inventory (after #580)
```bash
# Re-run roof sampling; emit OBSERVED | DERIVED | UNAVAILABLE counts
node scripts/geospatial/posey-building-height-inventory.mjs  # or existing COPC job
# Never invent heights: null stays null
```

## Step B — CityGML / CityJSON LOD2 shells
- Input: footprints + valid roof z only.  
- Emit CityJSON Building with `lod2` MultiSurface (Roof/Wall/Ground).  
- Properties: `heightSource`, `quality`, parcel id if public.

## Step C — glTF 2.0 + **meshopt** (EXT_meshopt_compression)
```bash
npm i -g @gltf-transform/cli
# Per-building or batched GLB from LOD2 meshes:
gltf-transform meshopt input.glb output.meshopt.glb --level medium
# Or full optimize (meshopt is default compress path in recent CLI):
gltf-transform optimize input.glb output.glb --compress meshopt --texture-compress webp
# Prefer meshopt over Draco for fast decode in MapLibre/3d-tiles-renderer
```
Apply **gzip/brotli** on the wire after meshopt.

## Step D — 3D Tiles 1.1
- OSS: py3dtilers / tyler / 3d-tiles-tools batch GLBs → tileset.json + content.  
- Implicit tiling when possible.  
- Host on GitHub Pages path or object storage; register URL in twin config.

## Step E — Cesium ion streaming (optional cloud path)
```text
POST https://api.cesium.com/v1/assets
Authorization: Bearer <ION_TOKEN>
{
  "name": "Posey-LOD2-Buildings",
  "type": "3DTILES",
  "options": {
    "sourceType": "CITYGML",   // or 3D_MODEL / upload GLB zip
    "clampToTerrain": true,
    "baseTerrainId": 1
  }
}
```
Then upload files to returned S3 URL → notify complete → poll until COMPLETE.  
Stream via ion asset id in CesiumJS, or export tiles for self-host MapLibre.

**Secrets:** `CESIUM_ION_ACCESS_TOKEN` (repo secret) — never commit.

## Step F — Wire twin client
- MapLibre + `3d-tiles-renderer` → tileset URL (Pages or ion).  
- Cesium viewer path for globe + ion terrain.  
- Routes: `/map`, `/twin`, `/digital-twin-v2`.

## Step G — Evidence / grants
Same tileset + height inventory JSON support civil packages and grant exhibits (HMA, 319, CCMG). Agencies decide awards.

## Non-claims
Incomplete heights remain UNAVAILABLE. Tiles are visualization; FIRM/BAFL/survey remain regulatory.
