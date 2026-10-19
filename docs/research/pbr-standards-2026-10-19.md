# PBR Material Standards — Explanation (TSM)

## What PBR is
Physically Based Rendering approximates energy-conserving light–surface interaction. glTF 2.0 standardizes the **metallic-roughness** workflow (Cook–Torrance microfacet BRDF).

## Core parameters
| Parameter | Range | Meaning |
|-----------|-------|--------|
| Base color (albedo) | RGB sRGB | Diffuse for dielectrics; F0 tint for metals |
| Metallic | 0–1 linear | 0 = dielectric, 1 = metal |
| Roughness | 0–1 linear | 0 = mirror, 1 = matte |
| Normal | tangent RGB | Perturbs shading normal |
| Occlusion | R linear | Ambient occlusion multiplier |
| Emissive | RGB | Self-illumination |

## Metallic-roughness texture packing (glTF MUST)
Single texture: **G = roughness**, **B = metalness**. R and A **ignored** for MR calculations.

## ORM atlas (TSM bake)
Common pack: **R = AO, G = Roughness, B = Metallic**. For glTF MR map: G→G, B→B; AO in `occlusionTexture` R.

## TSM integration
- `bake-pbr-atlas.py` / `bake-pbr-standard.py` / `pbr-atlas.ts`
- State-word **T** selects appearance tier under VRAM pressure

## Authority
Presentation only: `engineeringUse=false`, `regulatoryUse=false`.
