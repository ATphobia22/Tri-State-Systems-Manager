# Tri-State Systems Manager (TSM)

**Community-scale engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley.**

TSM combines authoritative river observations, geospatial evidence, engineering-model contracts, provenance, uncertainty and human review into an auditable decision-support system for communities, farms, transportation corridors, flood-resilience projects and public agencies. TSM is not a substitute for licensed engineering, surveying, regulatory review, emergency management, or other professional authority.

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## Current production status

**Deployment model:** GitHub Pages hosts the static Vite SPA. The Windows x64 native runtime is distributed as a verified offline bundle. Browser and API surfaces remain independently deployable.

| Surface | Location |
|---------|----------|
| **Primary branch** | `main` |
| **Public console (GitHub Pages SPA)** | https://atphobia22.github.io/Tri-State-Systems-Manager/ |
| **Windows x64 offline runtime** | GitHub Actions artifact `TSM-OFFLINE-RUNTIME-WINDOWS-X64-<commit>` |
| **API readiness** | `GET /ready` when an authorized API deployment is configured |
| **Console package** | `tsm-console` **v0.2.1** (React **19.3.0**, Vite **8.3.1**, `@react-three/fiber` **9.8.1**, MapLibre **6.11.2**, Three **0.186.1**, Vitest **5.0.2**, `@types/node` **26.6.2**) |

The Jekyll action output `Configuration file: none` is informational for the static artifact and is not a TSM Jekyll build. TSM publishes its Vite-generated `dist/` artifact directly.

The Pages workflow can publish the static console without a backend dependency. When an API is configured, `VITE_TSM_API_BASE_URL` must be an HTTPS origin.

Settings → Pages → Source must be **GitHub Actions**. The workflow does not fabricate or bypass that repository-level setting.

## What is deployable

TSM has two runtime planes:

- **Web console:** React 19 + TypeScript + Vite + MapLibre + Three.js / React Three Fiber.
- **Node API:** authoritative-source adapters, multi-gauge aggregation, evidence storage/verification, geospatial services and engineering endpoints.

The browser and API are intentionally separately deployable. GitHub Pages hosts the static browser plane; live river observations require the Node API over HTTPS (`VITE_TSM_API_BASE_URL`).

The Open World Twin geospatial plane also integrates:

- Indiana current imagery (ArcGIS ImageServer/WMS);
- USGS 3DEP elevation/hillshade visualization;
- Indiana current and 2025 parcel services;
- FEMA NFHL and Indiana BAFM as separate flood-authority planes;
- USGS/NOAA live hydrologic observations;
- historical Point Township plat/FIRM material as reference-only evidence;
- H3 spatial indexing (`h3-js` 4.5.0);
- PMTiles (`pmtiles` 4.5.0);
- NASA-AMMOS `3d-tiles-renderer` **0.5.3**;
- Protomaps basemap generation (OSM/Natural Earth) with required OSM attribution.

Live imagery and 3DEP layers are **source-bound visualization products**. They do **not** silently become survey-grade terrain, regulatory determinations, or engineering design surfaces. MapLibre 3D terrain remains fail-closed behind `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` until a materialized, provenance-controlled Terrain-RGB service is available.

## Community River Watch

The River Watch uses the registered USGS/NOAA station fabric and displays measured observations with explicit provenance and freshness states. The network includes New Harmony, Evansville, Newburgh, Old Shawneetown, Smithland, Cannelton, Olmsted, Markland, McAlpine and Louisville. J.T. Myers is retained as a **candidate** station until live runtime availability is independently verified.

Missing upstream observations are never guessed. Distinct states: `LIVE OBSERVATION`, `STALE`, `CANDIDATE — NOT LIVE`, `SOURCE UNAVAILABLE`.

```text
GET /api/hydrologic/community
```

## Engineering evidence

TSM separates:

1. external observation  
2. derived calculation  
3. model input  
4. model output  
5. engineering-review-ready evidence  
6. engineer acceptance  
7. agency acceptance  

Missing survey, geotechnical, hydraulic or laboratory evidence remains visible rather than fabricated.

Dredged material is **not presumed** structural fill. USACE Section 204 is a **conditional authority pathway**, not automatic funding or a guarantee of material availability.

### Evidence-gated engineering pipeline

```text
authoritative terrain
→ verified bathymetry/topobathy
→ datum control
→ baseline HEC-RAS
→ calibrated hydrology/hydraulics
→ alternative dredge/levee scenarios
→ independent cut/fill computation
→ sediment suitability
→ environmental screening
→ agency eligibility determination
→ documented BCA
→ funding applications
→ QA/QC
```

Machine-readable contract: `data/engineering/evidence-pipeline-contract.json` (schema under `data/schemas/`). CI: `npm run check:engineering-pipeline`.

### HEC-RAS spatial geometry (operator-run)

HEC-RAS 2D cell centers are model-project geometry. Ingestion discovers cell-center datasets, requires an **explicit source CRS**, and transforms into **EPSG:2966 (NAD83 / Indiana West, US survey feet)**. CRS is never guessed. No owner names, APNs or residential addresses are required by the privacy-reduced PostGIS registry. See `backend/engineering/hecras_geometry.py`, `scripts/seed_hec_ras_cell_centers.py`, and related PostGIS migrations.

## Data and authority hierarchy

## Provenance-aware flood information federation

TSM treats flood information as a federation of distinct authority planes rather than a single flood map. FEMA effective/NFHL products, Indiana DNR Best Available and regulatory-study products, DNR cross sections/model libraries, coordinated discharges, USGS StreamStats/inundation products, USACE levee evidence, terrain, and hydraulic-model outputs retain independent provenance and regulatory semantics.

Every flood result is required to carry:

- source authority and dataset/version;
- regulatory status;
- horizontal CRS and vertical datum;
- model lineage;
- retrieval timestamp;
- TSM software version;
- explicit uncertainty and limitations; and
- insurance-determination eligibility.

The machine-readable contract is `data/schemas/tsm-flood-information-federation-v1.schema.json`, enforced by `scripts/ci/validate-flood-federation.mjs`.


Primary-source government products are preferred: USGS Water Data, NOAA/NWS NWPS, USACE Louisville District, FEMA NFHL/FIRM/FIS, Indiana DNR Division of Water / BAFM / INFIP, USGS 3DEP and Indiana geospatial products, USDA NRCS, FHWA, NIST security/AI governance references.

Community historical records remain historical evidence and are never silently promoted to agency observations.

## Hydrologic datum rule

Raw gage height remains in its source-product datum. NAVD88 WSE is derived only with a validated, product-matched gage-zero conversion:

```text
WSE_NAVD88 = source_gage_height + validated_gage_zero_NAVD88
```

Station, parameter, time, units, datum, conversion metadata and provenance travel with the derived record. A station conversion does **not** by itself transfer WSE to a project site.

## Privacy boundary

The public architecture is **community-scoped**. It does **not** use a private residence, parcel/APN, owner record, account identifier or house-specific flood trigger as an engineering anchor.

## Repository map

```text
.github/workflows/      CI/CD and policy enforcement
backend/                Python domain helpers (HEC-RAS geometry, etc.)
data/                   schemas, registries, controlled evidence
db/                     persistence definitions
docs/                   engineering, deployment, governance
packages/               shared contracts
scripts/                CI, ingestion, GIS tooling
tools/                  specialized engineering/data tools
tsm-console/            React/Vite console + Node API + tests
deploy/                 deployment templates (e.g. Kubernetes)
ops/                    PostGIS, Martin, operational configs
```

Important runtime paths:

- `tsm-console/src/lib/river-gauges.ts` — community gauge contract  
- `tsm-console/server/ingestion/river-network-api.mjs` — multi-gauge aggregation  
- `tsm-console/server/token-proxy.mjs` — Node API  
- `docs/DEPLOYMENT-AND-OPERATIONS.md` — operations runbook  
- `COMPLIANCE.md` — authority and non-certification boundaries  

## Repository hygiene

`main` is the canonical integration and release branch. Short-lived feature and automation branches are expected to land through pull requests; stale or superseded branches should not be treated as deployment surfaces. Dependency updates are kept synchronized between `package.json` and `package-lock.json`.

## Engineering Fabric — deterministic computation + controlled capabilities

The engineering-fabric expansion is deliberately scoped as a **deterministic engineering computation layer + controlled external scientific capabilities + Unreal-native visualization**. Heavy third-party CAD, CFD, routing, computer-vision, numerical and post-processing stacks are **not embedded into the Unreal runtime**. They operate as capability workers behind explicit contracts.

**Authoritative merged state — 2026-09-29**

- PR **#155** (`feat(engineering): wire open-source engineering kernel fabric`) is merged into `main`.
- Feature head: `cecfff8e2fe6b587c2c478aa413fabf8554d736e`.
- Merge commit: `5d48c2647ed083b07f4c095925ceb0cd0912faed`.
- The dedicated **TSM Engineering Fabric** workflow for the feature head completed successfully, and the broader repository CI checks reported successful at that commit. Subsequent runtime/build workflows may continue independently; a running workflow is not treated as a failure.
- The feature branch was deleted after merge; `main` is the authoritative integration branch.
- Unreal Engine **5.8** remains the native runtime boundary.
- External dependencies are acquired into `.cache/tsm-third-party/` from the pinned lock; upstream repositories are not vendored into the Unreal runtime.
- OpenFOAM and Natron remain isolated worker boundaries because of GPL licensing. Mutable upstream revisions are rejected unless explicitly enabled for research builds and must be resolved to immutable commits before release packaging.

### Contracts and deterministic kernel

The fabric adds machine-readable contracts for:

- `TSM-DesignIR-2.0` design intermediate representation;
- `TSM-SolverResult-1.0` solver envelopes with input/result hashes, uncertainty and provenance;
- deterministic cinematic render recipes;
- capability-fabric mutation policy; and
- pinned third-party source/revision/license boundaries.

The native engineering kernel contains deterministic, unit-explicit screening calculations including rational peak flow, Manning flow/capacity, flood depth, design elevation/freeboard, berm geometry/volume and cut/fill. External workers cannot mutate native engineering state directly, and cinematic presentation cannot mutate engineering state.

### Controlled worker boundary

Worker execution is fail-closed: executable allowlists, no shell expansion, explicit timeouts and request/response byte limits, plus hashed I/O envelopes and provenance checks. Missing or disallowed workers, timeouts, oversized payloads and hash mismatches are failures—not reasons to fabricate a result.

### Windows 11 native deployment

Windows is the primary desktop engineering target. The supported build path is Unreal Engine 5.8 + Visual Studio 2022/MSVC on a Windows UE5 runner. The repository includes the native Windows build and packaging path at `scripts/native/Build-TSMNativeWindows.ps1`, including ArchimedesCore, packaged SpatiaLite, Unreal Shipping packaging and Inno Setup installer generation.

The Windows release workflow requires explicit UE5 runner capabilities, an immutable native data snapshot, pinned Cesium for Unreal **2.29.1**, packaged SpatiaLite, release-signing configuration, release provenance and SPDX SBOM generation. Unreal Engine, proprietary SDKs, signing certificates and generated release binaries remain outside source control.
## Spatial Runtime Fabric — AWS pattern adaptation

TSM incorporates selected architectural patterns from the reviewed AWS spatial material without making AWS a runtime dependency or an engineering authority.

- **Map plane:** MapLibre-compatible styles and tiles over PMTiles, Martin or controlled local tile origins.
- **3D plane:** OGC 3D Tiles/glTF/GLB with spatial HLOD, screen-space-error selection and bounded LRU residency.
- **Layer plane:** base map, terrain, imagery, context, hydrology, regulatory, engineering, historical and simulation layers retain independent authority/provenance metadata.
- **Simulation plane:** deterministic orchestration owns scenario execution; optional AI/agent tooling returns structured proposals that pass validation before any world-state transaction.
- **Cinematic plane:** Three.js/WebGPU in the browser and Unreal/OpenUSD for native presentation remain presentation boundaries and cannot promote visualization into evidence.
- **Offline/local mode:** source/tile artifacts can be materialized locally so the spatial runtime does not depend on AWS-managed services.

Machine-readable contracts:

- `architecture/contracts/spatial-runtime-fabric-v1.json`
- `architecture/contracts/aws-spatial-capability-adapter-v1.json`
- `architecture/contracts/spatial-layer-manifest-v1.json`

Validation is fail-closed through `npm run check:spatial-runtime` and the repository CI chain. Full design rationale and source register are in `docs/digital-twin/AWS-SPATIAL-IDEAS-ADAPTATION.md` and `docs/digital-twin/AWS-SPATIAL-SOURCE-REGISTER.md`.

## Windows x64 Offline Runtime

The canonical Windows 11 desktop distribution is built as a **native Windows x64 offline bundle** on a Windows runner.

Build pipeline: `.github/workflows/offline-runtime-windows.yml`.

The bundle includes Node 22/npm 10.9.2 caches, Windows-compatible Python wheels, the Vite production SPA, Node API health verification, TSM hydraulic contracts and read-only HDF5 support, Cargo-vendored Rust dependencies, Windows Tauri native packaging, and SHA-256 provenance manifests.

The distribution is named `TSM-OFFLINE-RUNTIME-WINDOWS-X64-<commit>.zip`.

The release gate is the successful Windows workflow plus artifact checksum verification. The existing Ubuntu/Linux offline bundle must **not** be treated as a Windows-native runtime.

### Offline installation

```powershell
./scripts/offline/install-bundle.ps1 -Bundle ./TSM-OFFLINE-RUNTIME-WINDOWS-X64-<commit>.zip
node ./scripts/offline/verify-installed-runtime.mjs
node ./scripts/offline/doctor.mjs
```

### Runtime boundary

```text
TSM source
  -> Windows offline installer
  -> verified npm/Python/Cargo dependency planes
  -> Vite web + Node API
  -> hydraulic contracts + read-only HDF5
  -> Windows Tauri native runtime
  -> authorized external HEC-RAS installation
```

HEC-RAS execution remains an **external authorized solver boundary**. The offline bundle does not fabricate solver results or silently package an HEC-RAS installation.

## Local development

```bash
cd tsm-console
npm ci                    # requires Node >= 22, npm 10.9.2 preferred
npm run ci:full           # full local gate suite
npm run dev               # Vite console
# API (separate terminal):
npm run proxy             # or npm run dev:all
```

| Service | Default |
|---------|---------|
| Web | http://localhost:3000 |
| API | http://localhost:8787 |
| Readiness | http://localhost:8787/ready |
| River Watch | http://localhost:8787/api/hydrologic/community |

Docker: `docker compose up --build` from the console or repo root as documented in `docs/DEPLOYMENT-AND-OPERATIONS.md`.

Hosted browser builds need `VITE_TSM_API_BASE_URL` (HTTPS). Restrict `CORS_ORIGIN` to the exact HTTPS web origin.

## CI and quality gates

```bash
cd tsm-console
npm run ci:full
```

Gates include dependency integrity, supply-chain / npx policy, SBOM, repository integrity, parse, TypeScript, geospatial and government-source contracts, live fabric, regulatory rules, engineering pipeline, schemas, production build, client-bundle secret scan, and production-gates tests.

Do **not** weaken or bypass a failing gate.

Notable workflows: `ci.yml`, `deploy-pages.yml`, `offline-runtime-windows.yml`, `tsm-parse-gate.yml`, `codeql.yml`, `open-world-twin.yml`, `ptdt-e2e-visual.yml`, `container-ci.yml`, `tsm-desktop.yml`, `tsm-engineering-fabric.yml`.

## Safety and professional authority

TSM is an engineering **decision-support and evidence** system. It does not certify a berm, road, bridge, levee, floodway analysis, survey, geotechnical report, environmental determination or regulatory filing. Construction and regulatory decisions require licensed professionals and applicable authorities.

Live observations are **not** emergency instructions. During an active event, official emergency-management and National Weather Service guidance controls.

## Production-readiness highlights

- **SPA routing on Pages:** `dist/404.html` copied from `index.html` for client routes.  
- **Vite `base`:** `/Tri-State-Systems-Manager/` under `GITHUB_ACTIONS` (project Pages path).  
- **CSP:** document-level policy for USGS, NOAA, FEMA, Indiana GIS, ArcGIS, OSM; `wasm-unsafe-eval` without general `unsafe-eval`.  
- **Auth:** OIDC BFF + PKCE; browser holds only HttpOnly session cookie.  
- **Hydrology:** timeouts, backoff, circuit breakers, LKG cache, explicit STALE — never relabeled as live.  
- **Datum middleware:** blocks undocumented NGVD29/gage-zero conversions.  
- **Autonomy:** Observe → Fuse → Predict → Propose → **Human Approval** → Controlled Execution → Audit (fail-closed; no arbitrary physical actuation).  

Horizontal engineering frame: **EPSG:2966**. **NAVD88** is tracked as separate vertical metadata — not assumed from EPSG:2966 alone.

## Development acceptance checklist

Before calling a release production-ready:

- [ ] `npm run ci:full` passes from a clean checkout  
- [ ] Browser build contains no credentials or signing keys  
- [ ] Terrain / FEMA / BAFM retain source identity and metadata  
- [ ] Model WSE cannot overwrite regulatory BFE records  
- [ ] Live hydrology freshness and datum states are visible  
- [ ] Production uses pinned dependencies and documented secrets management  
- [ ] Pages live site serves Vite SPA assets (not README/Jekyll shell)  
- [ ] API `/ready` SHA matches the release under verification  

## License

See [LICENSE](LICENSE). Contribution and security expectations: [SECURITY.md](SECURITY.md), [COMPLIANCE.md](COMPLIANCE.md).
