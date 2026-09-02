# TSM External Capability Integration

TSM consumes external repositories as **governed capability sources**, not as an uncontrolled vendor tree.

## Canonical rules

1. `integrations/registry/capabilities.json` is the machine-readable source for approved external capabilities.
2. Every source is pinned to an immutable commit SHA.
3. TSM owns authoritative geospatial data, regulatory evidence, schemas, workflows, and application behavior.
4. External shell code is never executed directly from a network fetch.
5. Esri CityEngine/Unreal capabilities are optional, licensed, and isolated to dedicated Windows infrastructure.
6. OpenFermion-Cirq is archived/deprecated and research-only; it cannot mutate authoritative state or make production regulatory decisions.
7. The 3D Geospatial repository is a reference source only because its repository content is not treated as an automatically reusable code/license dependency.

## Capability boundaries

| Capability | Integration | Production role |
|---|---|---|
| GitLab CI stack | Architecture reference | Optional runner/infrastructure design |
| Docker CI stack | Test topology reference | Ephemeral integration services |
| DevOps Bash tools | Curated patterns | Reviewed CI/ops scripts |
| CityEngine for Unreal | Dedicated adapter/build host | Offline digital-twin asset generation |
| CityEngine SDK | Licensed build adapter | Procedural geospatial asset generation |
| 3D Geospatial | Reimplemented patterns | 3D Tiles/glTF/LiDAR pipeline design |
| OpenFermion-Cirq | Research adapter reference | Isolated optimization experiments |

## Upgrade procedure

Update the immutable `ref` only after reviewing upstream changes, license status, platform/toolchain requirements, security impact, and regression results. A branch name such as `main` or `master` is never an acceptable production registry reference.
