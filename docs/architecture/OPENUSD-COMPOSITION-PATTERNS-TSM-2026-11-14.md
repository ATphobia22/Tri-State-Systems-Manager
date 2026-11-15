# OpenUSD composition patterns for TSM (2026-11-14)

Map OpenUSD arcs to the Tri-State open-world twin without treating USD as legal truth.

## Core arcs

| Arc | Role | TSM mapping |
|-----|------|-------------|
| **Sublayer** | Stack domain layers (geometry, materials, sim) | `terrain.usda` + `buildings.usda` + `flood_history.usda` + `cinematic.usda` |
| **Reference** | Graft reusable asset under many prims | One LOD1 shell → many parcels; plant/prop libraries |
| **Payload** | Deferred load of heavy geometry | County tilesets; load Posey when camera enters AOI |
| **VariantSet** | Alternate opinions | `quality=OBSERVED\|DERIVED\|UNAVAILABLE`; flood event year |
| **Inherit / Specialize** | Shared class refinement | Building class materials without editing source tiles |

## Reference–payload interface pattern

Keep a light **interface** prim (bbox, variants, metadata) and **payload** heavy mesh:

```usda
def Xform "PoseyBuilding_123" (
    payload = @./payloads/b123.usdc@
    variants = { string heightQuality = "DERIVED" }
) {
    variantSet "heightQuality" {
        "OBSERVED" {}
        "DERIVED" {}
        "UNAVAILABLE" {}
    }
}
```

Interface stays queryable without opening payloads (performance).

## Recommended stage layout

```text
World/
  Geospatial/          # Cesium/3D Tiles bridge or WGS84 anchors
  Terrain/             # payload county DEM meshes or external 3D Tiles ref
  Buildings/
    Posey/             # refs → per-building or batched payloads
    Gallatin/
  Hydro/
    Gages/             # live stage as non-geometry prims + time samples
    FloodEvents/       # variant or time-coded sublayers
  Cinematic/           # Megascans, skydome — never evidence authority
  Evidence/            # LOMA packages as metadata, not mesh truth
```

## LIVRPS strength (remember)

Local > Inherits > Variants > References > Payload > Sublayers — stronger opinions override weaker without destroying source files.

## Integration with current TSM stack

1. **Authoritative viz:** MapLibre/Cesium 3D Tiles (Posey Drive pack)  
2. **Optional USD stage:** Compose same layers for UE5.8 / Omniverse / offline render  
3. **Bridge:** Cesium for Unreal/Omniverse streams 3D Tiles into a USD stage; do not duplicate FIRM in mesh  
4. **Provenance:** loft `heightSource`, `crs`, `artifact_sha` above payload  

## Non-claims

USD composition is scene description. Flood maps, LOMA, and gages remain external evidence with human authority.
