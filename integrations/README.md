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

## Private operator metadata gateway

`managed_gateway.py` is a standard-library, read-only operator probe, not a public API or an OAuth broker. It checks current main and the configured reconstruction folder identity against the official GitHub and Drive HTTPS APIs. Provision short-lived credentials through the operator's secret manager as `TSM_GITHUB_TOKEN` (repository Contents read) and `TSM_DRIVE_TOKEN` (authorized Drive metadata access). Do not commit tokens, expose them to the browser, or run this probe in anonymous Pages builds.

Run from the repository root:

```bash
python3 integrations/managed_gateway.py
python3 -m unittest discover -s tests/geospatial -p test_managed_gateway.py -v
python3 -m unittest discover -s tests/geospatial -p test_legacy_import_guard.py -v
```

A missing token, unexpected response identity or failed request blocks the probe; provider redirects are rejected and responses are size-limited. Only main SHA, folder identity and mode are emitted. The probe is not evidence of a live authenticated platform session until executed with separately authorized credentials. Token renewal, uploads, resumable data transfer, audit persistence and authenticated administrator UI remain unimplemented. ChatGPT connector authorization is not transferable to this service.

The legacy CityGML import script is intentionally disabled until an independent production acceptance service verifies source/geometry evidence and 3DCityDB readiness. Do not bypass it by invoking the old Docker command.
