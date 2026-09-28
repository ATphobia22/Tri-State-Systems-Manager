# TSM External Repository Capability Matrix — 2026-09-28

## Integration rule

External projects are **not copied wholesale** into TSM. Each capability is isolated behind a TSM contract, with explicit license/provenance, authority boundaries, and CI validation.

| Capability | Upstream | TSM integration | Authority boundary | Status |
|---|---|---|---|---|
| Routing | Project OSRM / osrm-backend | `integrations/routing`, `/api/routing/route` | Derived routing only; never regulatory evidence | Implemented |
| 3D Tiles QA | CesiumGS / 3d-tiles-tools | validation contract + CI dependency | Derived asset validation | Implemented |
| 3D streaming | NASA-AMMOS / 3DTilesRendererJS | existing `3d-tiles-renderer` dependency | Presentation/runtime only | Existing + governed |
| Geometry authoring | Geoman MapLibre plugin | draft geometry adapter/contract | Draft/operator geometry; not authoritative | Implemented |
| CAD | CadQuery | isolated worker contract + Python worker | Derived engineering artifact | Implemented |
| Unity automation | Unity MCP | policy gateway + audit ledger | Tooling only; human approval for writes/publish | Implemented |
| Typed protocol | Buf protobuf-es | existing runtime/codegen stack | Transport/schema only | Existing + governed |
| Managed workers | Hermes-style patterns | bounded worker contract | Derived/quarantined outputs | Implemented |
| GPU workers | GPUStack | optional runtime manifest | Compute only; hash-gated outputs | Implemented (optional) |
| OpenUSD/Houdini | HoudiniUsdBridge | future interchange adapter | Presentation/asset interchange | Planned |
| Rendering farm | OpenCue | future worker adapter | Compute/rendering only | Planned |
| Terrain visualization | rayshader | reference/presentation | Never authoritative elevation | Planned |
| 4D Gaussian splats | 4d-gaussian-splatting | future presentation adapter | Visualization only | Planned |

## License/provenance notes

- OSRM is documented as BSD-2-Clause in its upstream repository metadata.
- CadQuery is Apache-2.0 and supports STEP/DXF/STL-class CAD export.
- 3D Tiles Tools is Apache-2.0.
- protobuf-es is Apache-2.0.
- MapLibre-Geoman Free is open source, but its project distinguishes free/open-source functionality from commercial licensing; TSM must keep the dependency/version and license review explicit before enabling features outside the free surface.

## Non-import policy

No source code from unrelated repositories is copied into TSM merely because it is available in the user's repository corpus. The adapter boundary is the security, licensing, and maintainability boundary.
