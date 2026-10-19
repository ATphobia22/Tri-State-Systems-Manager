# PBR Material Standards (TSM alignment) — 2026-10-19

## glTF 2.0 metallic-roughness (Khronos)

| Parameter | Role |
|-----------|------|
| `baseColorFactor` / `baseColorTexture` | albedo (sRGB) |
| `metallicFactor` | metalness [0,1] linear |
| `roughnessFactor` | roughness [0,1] linear |
| `metallicRoughnessTexture` | **B=metalness, G=roughness** (linear) |

ORM packing: often **R=AO, G=roughness, B=metallic**; map G/B into glTF MR texture.

TSM: `bake-pbr-atlas.py`, `pbr-atlas.ts`; state-word **T** selects appearance tier.
