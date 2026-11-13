# Open-world digital twin — bounded layer integration (2026-11-12)

## Scope of this change

This vertical slice connects **on-demand, bounded 2D reference geometry** from public Indiana GIO ArcGIS services directly into the existing MapLibre open-world canvas. It does not duplicate the repository's DEM, city-scene, 3D Tiles, FEMA, HEC-RAS, Unreal, or offline-packager implementations.

| User toggle | Service sublayer | Classification | Visual output |
| --- | --- | --- | --- |
| IGIO parcels | [2025 Parcel Boundaries](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0) | Context | 2D polygon outline |
| IGIO roads | [Current Road Centerlines](https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0) | Context | 2D line |
| IGIO buildings | [Building Footprints 2016–2020](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) | Derived reference | 2D footprint outline |

Each connection uses an on-demand WGS84 bbox query, a count preflight and a 2,000-feature cap, then parses GeoJSON before display. Overlarge extents, excessive feature counts, inconsistent data, offline requests, or upstream failures remain visibly unavailable; **never display a partial feature page as complete coverage**. The map remains usable independently of these optional services. The currently wired reference geometry covers **Indiana only**; do not assert full Illinois or Kentucky parity.

The existing `RealWorldTwinMap` renders a **collapsible, twelve-plane structural inventory** based on `docs/architecture/TSM-12-LAYER-STRUCTURAL-PIPELINE.md`. Each plane carries authority class, renderer registration/readiness and engineering limits. Renderer registration is deliberately **not** proof of a successful payload, source integrity, model validation, or regulatory eligibility. The new parcel/road/building toggles are opt-in so a normal map load triggers no additional IGIO feature requests.

## Runtime ownership

- **Frontend:** `tsm-console/src/lib/open-world-feature-fabric.ts` manages source lifecycle, count/GeoJSON querying, aborts and opacity. `tsm-console/src/components/RealWorldTwinMap.tsx` wires menu controls, statuses, and cleanup.
- **Plane governance:** `tsm-console/src/lib/open-world-layer-inventory.ts` maps the twelve structural planes to actual runtime capabilities, without promoting context geometry to engineering truth.
- **Native UE5.8:** existing `tsm-native/Source/TSMNative/TSMSceneLayerSubsystem.*` manages layer actors and declared source hashes. This browser implementation **does not** make those layers available in an Unreal Shipping build. A separate native actor import and offline-asset handoff are required.
- **Offline:** this new ArcGIS feature fabric requires network access. It is **not included in TSMData or the offline installer**. The existing local scene/tile bundles remain independent. Disable/live-unavailable behavior is expected when offline, rather than silently showing synthetic coverage.
- **Evidence:** a source URL, a displayed feature, and declared `bSourceVerified` on a native actor are not independent evidence. Only bytes that are staged, hashed, and independently checked may be promoted by existing evidence gates.

## Regression verification

```sh
cd tsm-console
npm ci --ignore-scripts --no-audit --no-fund
npx --no-install tsc --noEmit
node --experimental-strip-types --test tests/open-world-feature-fabric.test.mjs
node --test tests/open-world-twin-contract.test.mjs tests/open-world-overlays.test.mjs
```

The `open-world-twin.yml` pull-request workflow runs type checking and these new integration tests. The new tests cover official endpoint contract, per-layer opt-in, cleanup, zoom gating, source errors, truncation and all twelve plane authority classes.

## Separate acceptance evidence still required

1. **Real source verification** — headed browser fetch and geometry review for Posey County after enabling each layer, with official source metadata and retrieved bytes/hashes.
2. **Terrain** — full coverage, vertical datum, and real DEM import independent of visual shading. WGS84/MapLibre coordinates must never be silently treated as EPSG:2966 or NAVD88.
3. **3D** — HLOD/LoD geometry import, expected building identity and count reconciliation, streamed 3D Tiles in a headed runtime, measured frame-time/VRAM and inspected alignment.
4. **Hydraulics** — HEC-RAS input/result manifest, calibrated elevations/mesh, solver run and model hashes. Rendered flood overlays are not flood insurance determinations.
5. **Native/offline delivery** — Windows UE5.8 Shipping compilation/cook/package, clean offline Windows 11 launch, installed TSMData hash checks, actual screenshots/logs and a signing attestation tied to the packaged artifact. An Actions green result is not independent evidence of these tests.
6. **Tri-state breadth** — governed Illinois and Kentucky roads/parcels/buildings, comparable coverage and source authorities; these are not supplied by Indiana GIO services.

Human authority remains final, and cinematic presentation cannot modify or certify regulated engineering evidence.

## Opt-in 3D building tile subset

The canvas also exposes `3D Buildings (partial)`, sourcing the already-committed `tsm-console/public/3d-tiles/buildings-lidar-12450/tileset.json` as a separate Three.js 3D Tiles overlay. The source is a **derived subset**, not full Posey County LoD2–4 production evidence. Its `ready` status means only that the **tileset metadata loaded**, not that child GLBs rendered correctly or were independently validated. The tile-set's root registry explicitly records `sourceIdsReconciled=false`, `regulatoryUse=false` and `geojsonCountIsNotMeshCount=true`. Two 3D overlays can increase GPU load; both start disabled unless explicitly enabled by users. Offline availability requires those static assets to be included in the deployed bundle and an independent file-integrity check.

## Runtime checksum hardening

`scripts/offline/verify-installed-runtime.mjs` now recomputes SHA-256 values for every file listed in the staged `SHA256SUMS` (and optional `manifest.files`) instead of checking only whether the manifest exists. Invalid checksum syntax, missing files, changed bytes, symlinks, path traversal, incorrect lengths and conflicting records cause failure. The Windows and Linux offline build manifests are accepted only with their required structure; Windows must identify `windows-x64`. `scripts/offline/runtime-integrity.test.mjs` tests common tampering and ambiguity cases, and `open-world-twin.yml` executes these tests. `offline-runtime.yml` now invokes the verifier before packaging.

This is **integrity verification, not a digital signature**. Release signing and independent attestations are separate in `.github/workflows/tsm-native.yml` and require actual authorized Windows UE5.8 builds and credentials.
