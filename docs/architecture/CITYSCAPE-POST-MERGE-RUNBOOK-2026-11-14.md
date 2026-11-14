# Cityscape post-merge runbook (2026-11-14)

**Merged:** #580 COPC multipart roofs · #581 DEM staging recovery

## 1. Height inventory
```bash
# From repo root after pull
npm ci  # if needed
# Prefer project scripts that already exist for Posey COPC / parcels:
node scripts/geospatial/posey-building-height-inventory.mjs 2>/dev/null || \
  node packages/geo/src/nfhl/cli/validate-nfhl.mjs --help
# Emit counts: OBSERVED | DERIVED | UNAVAILABLE — never fill defaults
```

## 2. LOD2 shells
- Footprints + OBSERVED/DERIVED heights only → CityJSON / LOD2 MultiSurface
- Property bag: heightSource, quality, id

## 3. meshopt GLB
```bash
chmod +x scripts/geospatial/meshopt-glb.sh
./scripts/geospatial/meshopt-glb.sh building.glb
# or: gltf-transform meshopt in.glb out.meshopt.glb --level medium
```

## 4. 3D Tiles
- Batch meshopt GLBs → tileset.json (py3dtilers / tyler / 3d-tiles-tools)
- Publish under `public/3d-tiles/posey-lod2/` or object storage

## 5. Twin stream
- MapLibre + 3d-tiles-renderer → tileset URL
- Optional: Cesium ion asset (CITYGML / 3DTILES) with clampToTerrain
- Routes: /map · /twin · /digital-twin-v2

## 6. Evidence
Height inventory JSON + tileset hash → LOMA / grant exhibit package
