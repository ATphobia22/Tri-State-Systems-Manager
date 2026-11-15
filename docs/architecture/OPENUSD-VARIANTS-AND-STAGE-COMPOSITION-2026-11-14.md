# OpenUSD asset variants & stage composition — TSM (2026-11-14)

Extends `OPENUSD-COMPOSITION-PATTERNS-TSM-2026-11-14.md` with variant design and a concrete stage recipe.

## Asset variants (VariantSet)

A **variant set** is a named menu of alternate opinions on a prim. Selecting a variant composes only that choice’s specs.

### TSM-recommended variant sets

| VariantSet | Choices | Purpose |
|------------|---------|---------|
| `heightQuality` | OBSERVED · DERIVED · UNAVAILABLE | Provenance; never invent height |
| `lod` | LOD0 · LOD1 · LOD2 | Geometry budget |
| `floodEvent` | none · 1913 · 1937 · 2008 · 2011 · custom | Historical overlay |
| `displayMode` | engineering · cinematic | Evidence vs dress |
| `sourceAuthority` | FIRM · survey · model · demo | Label strength |

### Design rules (from Learn OpenUSD)

1. Prefer **few orthogonal** sets over combinatorial explosion.  
2. Author opinions **inside** the variant edit context — a Local opinion outside the set wins over Variant (LIVRPS) and silently breaks switches.  
3. Structural changes (different refs/payloads) are costlier than value overrides — use value/material variants for frequent toggles.  
4. Entry-point variants are public API; document required sets.  
5. For continuous params (tint), prefer **primvars** over variants; variants create new prototypes when instanced.

### Example interface

```usda
#usda 1.0
def Xform "Building_Posey_008" (
    assetInfo = {
        dictionary tsm = {
            string parcelId = "65-19-08-100-008.001-010"
            string heightSource = "DERIVED"
        }
    }
    payload = @./payloads/posey_008.usdc@
    variants = {
        string heightQuality = "DERIVED"
        string lod = "LOD1"
    }
    variantSets = ["heightQuality", "lod"]
)
{
    variantSet "heightQuality" = {
        "OBSERVED" { }
        "DERIVED" { }
        "UNAVAILABLE" {
            # deactivate mesh payload path or show placeholder
            bool active = false
        }
    }
    variantSet "lod" = {
        "LOD0" { }
        "LOD1" { }
        "LOD2" { }
    }
}
```

## Stage composition recipe

```text
root.usda                    # sublayers only; no heavy geo
  00_geospatial.usda         # CRS anchors, Cesium bridge metadata
  10_terrain.usda            # payloads / external 3D Tiles refs
  20_buildings.usda          # references → county instance roots
  30_hydro_live.usda         # gage prims + timeSamples (app-fed)
  40_flood_history.usda      # floodEvent variants
  50_evidence.usda           # LOMA/package metadata (non-mesh)
  90_cinematic.usda          # Megascans, skydome — weakest for truth
```

Composition order: list **stronger (local edits) last** in `subLayers` if you want session overrides on top; remember LIVRPS still governs arcs on each prim.

## Gates wired in code

See `packages/openusd/` and `packages/release-gates/`:

- Variant selection must not claim FIRM authority  
- `displayMode=cinematic` forces SIMULATION_DEMO banner  
- `heightQuality=UNAVAILABLE` forbids numeric freeboard calc from that prim  
- Human review remains required for LOMA package export  

## Learn path

1. Variant sets basics → asset parameterization (variants vs primvars)  
2. Reference / payload interface pattern  
3. LIVRPS strength  
4. Factory-style aggregation (Omniverse VFI) mapped to counties  
