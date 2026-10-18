# CityEngine PBR & CGA Guide for TSM

**Date:** 2026-10-18
**Purpose:** Document Esri CityEngine's PBR material standards and CGA scripting so TSM's glTF 2.0 PBR pipeline (`scripts/3d-tiles/bake-pbr-standard.py`) can interoperate with CityEngine-authored content.

---

## 1. CityEngine PBR Material Specification

CityEngine uses the **metallic/roughness PBR workflow** (not specular/glossiness). Its material model maps 1:1 onto the glTF 2.0 `pbrMetallicRoughness` specification. The following table is taken from Esri's own community-verified mapping (CGA material attributes → glTF material spec):

### CGA → glTF 2.0 PBR Mapping (authoritative)

| CGA material attribute | glTF 2.0 property |
|---|---|
| `material.color.{r\|g\|b}` | `pbrMetallicRoughness.baseColorFactor` (RGB) |
| `material.opacity` | `pbrMetallicRoughness.baseColorFactor` (A) |
| `material.colormap` | `pbrMetallicRoughness.baseColorTexture` (RGB channels) |
| `material.opacitymap` | `pbrMetallicRoughness.baseColorTexture` (A channel) |
| `material.metallic` | `pbrMetallicRoughness.metallicFactor` |
| `material.roughness` | `pbrMetallicRoughness.roughnessFactor` |
| `material.metallicmap` (**B channel only**) | `pbrMetallicRoughness.metallicRoughnessTexture` (B channel) |
| `material.roughnessmap` (**G channel only**) | `pbrMetallicRoughness.metallicRoughnessTexture` (G channel) |
| `material.normalmap` | `normalTexture` |
| `material.occlusionmap` (**R channel only**) | `occlusionTexture` (R channel) |
| `material.emissivemap` | `emissiveTexture` |
| `material.emissive` | `emissiveFactor` |
| `material.opacitymap.mode` | `alphaMode` |
| `material.opacitymap.cutoff` | `alphaCutoff` |

### Texture Layer Index (CGA `projectUV`)

CityEngine organizes textures into 10 numbered layers. The PBR-relevant ones:

| Layer | CGA attribute | PBR name | Channel packing |
|---|---|---|---|
| 0 | `material.colormap` | Albedo / base color | RGB |
| 4 | `material.opacitymap` | Alpha | A (of colormap) |
| 5 | `material.normalmap` | Normal | RGB, tangent space |
| 6 | `material.emissivemap` | Emissive | RGB |
| 7 | `material.occlusionmap` | Ambient occlusion | **R channel only** |
| 8 | `material.roughnessmap` | Roughness | **G channel only** |
| 9 | `material.metallicmap` | Metallic | **B channel only** |

Layers 1 (`bumpmap`), 2 (`dirtmap`), 3 (`specularmap`) are **legacy non-PBR** and should be ignored for PBR workflows.

### Critical Channel-Packing Rules

CityEngine follows the glTF 2.0 convention for packed textures:

- **Metallic-Roughness texture:** a single RGB texture where **G = roughness**, **B = metallic**. R and A are ignored.
- **Occlusion texture:** **R channel only**. G, B, A are ignored.
- **Normal map:** full RGB, tangent-space normals encoded as colors (OpenGL convention: +Y up).
- **Bump maps** are interpreted as luminance (CCIR 601) — do not confuse with normal maps.

### PBR Shader Selection

Set the shader explicitly in CGA:

```cga
set(material.shader, "CityEnginePBRShader")
```

Without this, CityEngine may fall back to its legacy Lambert/Phong shader and ignore the metallic/roughness maps.

---

## 2. CGA Scripting Primer

CGA (Computer Generated Architecture) is CityEngine's shape-grammar language. Rules transform 2D footprints into 3D models through operations like `extrude`, `split`, `comp`, and `set`.

### Minimal Building Example (PBR-ready)

```cga
/**
 * File: tsm_building.cga
 * Simple PBR-textured building for TSM interoperability.
 * Assign to a polygon footprint, then Generate (Ctrl+G).
 */

version "2023.1"

// ---- Parameters (exposed in Inspector) ----
attr buildingHeight = 12
attr floorHeight    = 3
attr wallAlbedo     = "assets/wall_albedo.png"
attr wallNormal     = "assets/wall_normal.png"
attr wallRoughness  = "assets/wall_roughness.png"   # grayscale -> G channel
attr wallMetallic   = 0.0                            # non-metal default
attr roofAlbedo     = "assets/roof_albedo.png"

// ---- Start rule ----
@StartRule
Footprint -->
    extrude(buildingHeight)
    comp(f) { side : Facade | top : Roof | bottom : Base }

// ---- Facade: split into floors, apply PBR wall material ----
Facade -->
    split(y) { floorHeight : Floor }*

Floor -->
    set(material.shader, "CityEnginePBRShader")
    set(material.colormap, wallAlbedo)
    set(material.normalmap, wallNormal)
    set(material.roughnessmap, wallRoughness)
    set(material.metallic, wallMetallic)
    set(material.roughness, 0.85)          # fallback scalar if map missing
    projectUV(0)                            # layer 0 = colormap UVs
    projectUV(5)                            # layer 5 = normalmap UVs
    projectUV(8)                            # layer 8 = roughnessmap UVs
    // Punch window openings every 3 m
    split(x) { ~3 : WallSegment }*

WallSegment -->
    // Alternate wall / window by split index
    case split.index % 2 == 0 :
        Window
    else :
        Wall

Wall --> NIL   // material already set on Floor

Window -->
    set(material.colormap, "assets/window_albedo.png")
    set(material.metallic, 0.9)            # glass frame reads as metal
    set(material.roughness, 0.15)          # glossy
    projectUV(0)
    s('0.9, '0.9, 1)                       # inset slightly
    t(0.05, 0.05, 0)
    NIL

// ---- Roof: flat cap with PBR roof material ----
Roof -->
    set(material.shader, "CityEnginePBRShader")
    set(material.colormap, roofAlbedo)
    set(material.roughness, 0.95)
    set(material.metallic, 0.0)
    projectUV(0)

Base --> NIL
```

### Key CGA Operations Used Above

| Operation | Purpose |
|---|---|
| `extrude(h)` | Pull 2D footprint up into a 3D mass of height `h` |
| `comp(f)` | Component split: decompose mass into `side`, `top`, `bottom` faces |
| `split(y) { ~3 : Floor }*` | Split along Y into repeating ~3 m floor slabs |
| `split(x) { ~3 : WallSegment }*` | Split along X into repeating ~3 m bays |
| `set(material.*, ...)` | Assign PBR material attribute |
| `projectUV(n)` | Generate UV coordinates for texture layer `n` |
| `case ... : ... else : ...` | Conditional branching on split index, attributes, etc. |
| `s('0.9,'0.9,1)` / `t(...)` | Scale / translate the current shape's scope |

### Exporting to glTF 2.0 from CityEngine

1. Select generated models → **File → Export → glTF**.
2. Choose **glTF 2.0 (.glb)** with **PBR materials**.
3. CityEngine writes `pbrMetallicRoughness` blocks using the CGA→glTF mapping in §1 — no manual conversion needed if the PBR shader was set.

---

## 3. Mapping Table: TSM → CityEngine → glTF 2.0

TSM's `bake-pbr-standard.py` emits **five separate grayscale/RGB maps**. CityEngine/glTF expect **packed** textures for metallic-roughness and occlusion. The packing step is the only transformation required.

### TSM bake output → CityEngine input

| TSM `bake-pbr-standard.py` output | Colorspace | CityEngine CGA attribute | glTF 2.0 destination |
|---|---|---|---|
| `*_albedo.png` | sRGB | `material.colormap` | `baseColorTexture` (RGB) |
| `*_normal.png` | Linear | `material.normalmap` | `normalTexture` (RGB) |
| `*_roughness.png` | Linear (grayscale) | `material.roughnessmap` → **G channel** of packed texture | `metallicRoughnessTexture` (G) |
| `*_metallic.png` | Linear (grayscale) | `material.metallicmap` → **B channel** of packed texture | `metallicRoughnessTexture` (B) |
| `*_ao.png` | Linear (grayscale) | `material.occlusionmap` → **R channel** of packed texture | `occlusionTexture` (R) |

### Packing script (TSM → CityEngine/glTF convention)

Run after `bake-pbr-standard.py` to produce the packed textures CityEngine and glTF expect:

```python
#!/usr/bin/env python3
"""Pack TSM separate PBR maps into glTF/CityEngine channel-packed textures.

Input  (from bake-pbr-standard.py):
    <name>_roughness.png   grayscale, linear
    <name>_metallic.png    grayscale, linear
    <name>_ao.png          grayscale, linear
Output (glTF 2.0 / CityEngine convention):
    <name>_metallicRoughness.png   RGB: G=roughness, B=metallic (R,A unused)
    <name>_occlusion.png           RGB: R=ao (G,B unused)
Requires: Pillow  (pip install Pillow)
"""
import argparse
from pathlib import Path
from PIL import Image

def pack_metallic_roughness(rough_path: Path, metal_path: Path, out_path: Path):
    rough = Image.open(rough_path).convert("L")
    metal = Image.open(metal_path).convert("L")
    assert rough.size == metal.size, "roughness/metallic resolution mismatch"
    # R=0 (unused), G=roughness, B=metallic
    packed = Image.merge("RGB", (
        Image.new("L", rough.size, 0),
        rough,
        metal,
    ))
    packed.save(out_path)
    print(f"wrote {out_path}  (G=roughness, B=metallic)")

def pack_occlusion(ao_path: Path, out_path: Path):
    ao = Image.open(ao_path).convert("L")
    blank = Image.new("L", ao.size, 0)
    # R=ao, G=0, B=0 (glTF reads R only)
    packed = Image.merge("RGB", (ao, blank, blank))
    packed.save(out_path)
    print(f"wrote {out_path}  (R=occlusion)")

def main():
    ap = argparse.ArgumentParser(description="Pack TSM PBR maps to glTF/CityEngine convention")
    ap.add_argument("--prefix", required=True,
                    help="Path prefix, e.g. ./out/wall  (reads wall_roughness.png etc.)")
    args = ap.parse_args()
    p = Path(args.prefix)
    d = p.parent
    n = p.name
    pack_metallic_roughness(d / f"{n}_roughness.png",
                            d / f"{n}_metallic.png",
                            d / f"{n}_metallicRoughness.png")
    pack_occlusion(d / f"{n}_ao.png",
                   d / f"{n}_occlusion.png")

if __name__ == "__main__":
    main()
```

Usage:

```bash
# 1. Bake (existing TSM pipeline)
blender -b --factory-startup model.blend --python scripts/3d-tiles/bake-pbr-standard.py -- \
  --input highpoly.glb --output ./out/ --resolution 2048

# 2. Pack for CityEngine / glTF
python scripts/3d-tiles/pack_pbr_cityengine.py --prefix ./out/wall
```

Then in CGA, reference the packed files:

```cga
set(material.colormap, "wall_albedo.png")            # sRGB albedo, RGB
set(material.normalmap, "wall_normal.png")           # tangent-space normal
set(material.roughnessmap, "wall_metallicRoughness.png")  # reads G channel
set(material.metallicmap,  "wall_metallicRoughness.png")  # reads B channel
set(material.occlusionmap, "wall_occlusion.png")     # reads R channel
```

Note: `roughnessmap` and `metallicmap` point at the **same packed file** — CityEngine samples G and B respectively, exactly like glTF.

---

## 4. TSM Integration Recommendations

1. **Adopt the packer as a pipeline stage.** Add `pack_pbr_cityengine.py` as `scripts/3d-tiles/pack-pbr-cityengine.py` and call it at the end of the PBR bake pipeline so every baked asset ships both the TSM-native separate maps (for inspection/debugging) and the packed glTF/CityEngine variants (for distribution).

2. **Keep `bake-pbr-standard.py` output unchanged.** Separate maps are easier to QA visually. Packing is a lossless channel shuffle — do it as a post-step, not a replacement.

3. **Normal-map convention check.** TSM bakes OpenGL-format normals (+Y up); CityEngine documents tangent-space RGB normals, which matches OpenGL convention. No Y-flip needed. (DirectX-format bakes would need a flip — verify per-asset if sources vary.)

4. **Colorspace discipline.** Albedo/colormap must be sRGB; roughness, metallic, normal, and occlusion must be Linear. Baking sRGB into a roughness map is the most common PBR authoring error and produces visibly wrong specular response.

5. **Scalar fallbacks.** Always set `material.roughness` / `material.metallic` scalars alongside maps (as in the example CGA above). If a map is missing at export time, CityEngine falls back to the scalar instead of rendering black.

6. **Displacement maps have no CGA slot.** CityEngine cannot author displacement for PBR export. If TSM assets carry displacement, bake its effect into geometry (LOD) or the normal map before CityEngine ingest.

7. **Round-trip path.** CityEngine → glTF 2.0 export preserves the full PBR material graph per the §1 table, so CityEngine-authored buildings can feed TSM's 3D Tiles pipeline directly. The reverse path (TSM → CityEngine) works via the packed textures + the example CGA material-assignment pattern.

---

## Sources

- Esri Community, "Demo of PBR in CityEngine?" — CGA→glTF PBR attribute mapping table (community-verified against the glTF 2.0 spec).
- Esri CityEngine Resources, `material.map` attribute documentation — 10 texture layers, channel-packing rules (roughness=G, metallic=B, occlusion=R), tangent-space normal interpretation.
- Esri Community, "The missing ultimate guide to PBR texturing in CityEngine" — practical PBR texturing workflow, `CityEnginePBRShader` selection, `projectUV` layer pattern.
- Esri CityEngine Tutorials, "Tutorial 1: Essential Skills" — CGA rule assignment, `extrude`/`split`/`comp`/`set` operations, seed variation.
- Esri CityEngine Resources, `set` operation documentation — `set(material.*)` syntax for builtin shape attributes.
- ArcGIS Maps SDK for JavaScript, `MeshMaterialMetallicRoughness` reference — confirms glTF packing convention (metallic=B, roughness=G, occlusion=R) used across the Esri platform.
