# Optional CityEngine Authoring (P3) — 2026-10-19

**Non-blocking.** No CE binary in CI.

## Workflow
1. Import footprints as CE shapes.
2. CGA with `set(material.shader, "CityEnginePBRShader")`.
3. Export **glTF 2.0**.
4. TSM: RTC + PBR atlas + state-word v1 + `authorityClass=DERIVED`.

## Minimal CGA
```cga
attr height = 10
Lot --> extrude(height) Mass
Mass --> comp(f) { side: Facade | top: Roof }
Facade -->
  set(material.shader, "CityEnginePBRShader")
  set(material.metallic, 0.1)
  set(material.roughness, 0.7)
  FacadeFinish.
```

## CE ↔ glTF channels
| CE | glTF |
|----|------|
| colormap | baseColorTexture |
| metallicmap B | metallicRoughnessTexture B |
| roughnessmap G | metallicRoughnessTexture G |
| occlusionmap R | occlusionTexture R |
| normalmap | normalTexture |
