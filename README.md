# Tri-State Systems Manager (TSM)

**Community-scale engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley.**

TSM combines authoritative river observations, geospatial evidence, engineering-model contracts, provenance, uncertainty and human review into an auditable decision-support system for communities, farms, transportation corridors, flood-resilience projects and public agencies. TSM is not a substitute for licensed engineering, surveying, regulatory review, emergency management, or other professional authority.

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## Current production status

**Deployment model:** GitHub Pages hosts the static Vite SPA. The Windows x64 native runtime is distributed as a verified offline bundle. The browser/API surfaces remain independently deployable.

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

## System status — 2026-10-05

### Fixed

- **Twin live telemetry (`f630ce9`):** the digital twin status panel now shows real USGS 03378500 observations — stage, discharge, and station WSE NAVD88 via the published SIR 2016-5119 gage-zero conversion (+352.67 ft). One-time fetch on page load (user-initiated); provisional qualifiers; no polling or auto-refresh. Site transfer and hydraulic extrusion remain fail-closed pending a validated hydraulic profile — not invented.
- **Site elevations wired with provenance:** BFE 375.0 ft (2026-08-22 LOMA checklist working value; FIRM panel 18129C0300C verification pending), LAG 377.2 ft / FFE 382.5 ft / berm crest 379.8 ft (owner-supplied, uncertified), clearance 2.2 ft (derived). None claimed as certified survey.
- **LOD1–LOD4 pipeline:** parcel → terrain → building derivation complete (4,121 features, 1,233 flooded at the 375.0 ft screening scenario); deterministic 3D building tiles generated and validated (OGC 3D Tiles 1.1, 4,121 GLBs).

### CI

- All 12 GitHub Actions workflows green on `main`, including the Windows x64 Offline Runtime.

### Still blocked

- **Oracle Cloud:** the Always Free A1 retry remains blocked on the rejected saved login (auth, not capacity). Instance creation cannot proceed until the vault password is refreshed.
- **Branch hygiene:** fully-merged branches and stale refs removed. Four feature branches retain unique work behind `main` — merge decision left to the owner.

## System status — 2026-10-02

### Working

- **3D Tiles terrain (self-hosted, token-free):** OGC 3D Tiles 1.1 tileset generated in CI from the USGS 3DEP Terrain-RGB pyramid (478 tiles, z8–z12). The `ThreeDTilesLayer` camera sync is wired to the MapLibre map instance (`map` prop + `mapReady` gate) with WebGL context-loss recovery. No Cesium, no ion token — `3d-tiles-renderer` (MIT) + Three.js only.
- **Parcel layer:** 4,121 Posey County parcel features served as static GeoJSON (`tsm-console/public/data/posey-parcels.geojson`). Provenance is explicit: bounding-box filtered from the XSoft offline bundle; township assignment and WTH Property Record Card linkage are marked **unverified** rather than asserted. Owner-name fields stripped.
- **Backend tests:** 84 passed, 8 subtests passed (pytest from repo root; `backend/conftest.py` fixes the `sys.path` collection issue).
- **Hydrology:** 13-station USGS registry. Live observations only via user-initiated snapshot (`POST /api/hydrologic/snapshot`) — no automatic polling. USGS 03378500 = Wabash River at New Harmony, IN; 03377500 = Wabash River at Mt. Carmel, IL (verified 2026-10-02).
- **Site constants:** `backend/gov/site_constants.py` remains fail-closed by owner governance decision (`VERTICAL_DATUM = "UNVERIFIED"`, `PARCEL_APN` / `FIRM_PANEL` / `COMMUNITY_ID = "SOURCE_REQUIRED"`). An earlier claim that these were resolved was reverted by owner commit `bb54a82`. Verified station-level values (e.g. USGS 03378500 gage-zero 352.67 ft NAVD88 per SIR 2016-5119) are carried in source-specific records, not the global constants.

### Deliberately out of scope

- **CityGML LOD4 interiors:** the twin targets flood-relevant **LOD1/LOD2** (parcel → terrain → building extrusion → flood-depth analysis). Interior room/furniture modeling is not a flood-engineering requirement and is not planned.
- **UE5 Pixel Streaming:** no signaling server, WebRTC, or streaming implementation exists in the repo, by design. Pixel Streaming requires a GPU host; the Always Free deployment target has none. This remains an explicit user decision, not a backlog item.
- **OpenMI WSE auto-feed:** no live water-surface-elevation endpoint is configured. The UI shows `DISCONNECTED` honestly rather than synthesizing values. USGS gage-height telemetry is available on demand; NAVD88 WSE derivation requires a validated gage-zero conversion per station.

### Known limitations

- Parcel township attribution needs an exact township-boundary intersection (currently bounding-box only, marked provisional).
- The 3D camera sync uses an approximate zoom→distance formula with fixed 60° FOV — functional for visualization, not survey-grade.
- `bfeFtNavd88: 375.0` is applied blanket-wide across parcel features (Point Township target BFE), not per-parcel verified.

## Posey County authoritative offline package

Posey County (FIPS 18129) is acquired as a **strict, dated offline snapshot**, not as a bounding-box approximation.

The acquisition pipeline uses POST for ArcGIS REST queries so exact county geometry does not hit URI-length limits.

The acquisition pipeline:

1. resolves the exact 2026 Posey County boundary from U.S. Census TIGERweb;
2. filters spatial ArcGIS sources against the exact county polygon: `esriSpatialRelWithin` for county-contained framework features and `esriSpatialRelIntersects` for legitimate cross-boundary coverage/footprint products;
3. requires the complete FEMA / USGS / Indiana DNR / Indiana GIO / USACE source manifest;
4. records source URL, authority, feature/byte counts, retrieval timestamp and SHA-256;
5. validates every required artifact and its hash before packaging; and
6. creates a validation receipt before the ZIP can be published.

Verified Indiana GIO framework vintages used by the acquisition contract include **2025 parcels, 2025 address points, 2025 road centerlines, and 2025 administrative boundaries**. The official Indiana services identify those releases explicitly. 

The USACE NLD spatial endpoint is the official `NLD/Public/FeatureServer`, with `Leveed Areas` at layer 16.

**Fail-closed rule:** a missing endpoint, empty required artifact, source/authority mismatch, SHA-256 mismatch, or violation of the strict county extraction policy fails the acquisition job. A partial ZIP is not considered a release.



## Complete system overview

TSM is a provenance-first, evidence-gated geospatial and engineering platform. The repository is split into independently testable planes so acquisition, transformation, visualization, engineering analysis, publication, and human review can be verified without collapsing authoritative government data into one undifferentiated layer.

### Architecture planes

| Plane | Repository locations | Primary responsibility |
|---|---|---|
| Web / 3D console | `tsm-console/` | React/TypeScript UI, MapLibre, Three.js/React Three Fiber, flood visualization, live data presentation, accessibility and client-side contracts. |
| Node/API | `tsm-console/server/`, `backend/` | Source adapters, hydrologic aggregation, evidence APIs, geospatial services, provenance, readiness and policy enforcement. |
| Python engineering | `backend/`, `tools/` | HEC-RAS geometry, GIS acquisition/validation, evidence packets, LOMA/FIRMette tooling, geospatial and engineering utilities. |
| Contracts / schemas | `data/schemas/`, `packages/` | Machine-readable data, ontology, engineering, regulatory, provenance and runtime contracts. |
| Data / evidence | `data/`, `evidence/`, `artifacts/` | Controlled source registries, snapshots, manifests, authority records and evidence products. |
| Persistence | `db/`, `ops/` | PostGIS/database definitions, tile services, operational configuration and geospatial storage. |
| Native / desktop | `tsm-native/`, `native/` | Windows/native runtime packaging, geospatial native dependencies and desktop integration. |
| CI/CD / security | `.github/workflows/`, `scripts/ci/`, `SECURITY.md` | Build, parse, dependency, provenance, source, schema, security, Pages and runtime verification. |
| Documentation / governance | `docs/`, `COMPLIANCE.md` | Architecture, deployment, regulatory boundaries, evidence standards, operations and review procedures. |

### Core data flow

```text
government / authoritative source
        ↓
source adapter + acquisition contract
        ↓
validation + CRS/datum checks + freshness checks
        ↓
provenance record + SHA-256/integrity evidence
        ↓
normalized data / tiles / model inputs
        ↓
geospatial + hydrologic + engineering services
        ↓
visualization / simulation / evidence packet
        ↓
human engineering / agency review
        ↓
controlled publication
```

The system is fail-closed: unavailable, stale, unverifiable, incorrectly referenced, or insufficiently supported data remains explicitly marked rather than silently substituted with synthetic values or presented as authoritative.

## Government data and authoritative public sources

The canonical machine-readable source inventory is `data/schemas/tsm-indiana-data-catalog-v1.json`. The current catalog contains 21 registered government/public-sector sources. A catalog entry is not by itself a claim that every endpoint is continuously live; runtime use is separately validated by the corresponding CI/runtime contracts.

| Source | Authority / public body | TSM function |
|---|---|---|
| USGS The National Map / TNMAccess | U.S. Geological Survey | National geospatial discovery and authoritative terrain/data acquisition. |
| USGS 3DEP Elevation Index | U.S. Geological Survey | Locate and bind 3DEP elevation coverage and source metadata. |
| Indiana 2016–2020 Elevation ImageServer | Indiana geospatial program | Indiana elevation/DEM visualization and terrain evidence. |
| USGS Water Data APIs + WaterServices | U.S. Geological Survey | Live and historical streamflow, gage height, monitoring-location metadata and hydrologic observations. |
| NOAA National Water Prediction Service (NWPS) | NOAA / National Weather Service | Forecast, gauge and water-prediction context for river conditions. |
| FEMA National Flood Hazard Layer (NFHL) | Federal Emergency Management Agency | Effective regulatory flood-hazard, FIRM/FIS and insurance-reference layers. |
| Indiana Best Available Flood Hazard Layer (BAFM/BAFL) | Indiana DNR | Best-available/non-final flood hazard context, explicitly separated from effective FEMA determinations. |
| USACE National Levee Database (NLD2) | U.S. Army Corps of Engineers | Levee/structure evidence and flood-protection asset context. |
| Indiana PLSS boundaries | Indiana Geographic Information Office / DNR | Public land-survey reference geometry. |
| Indiana current parcel boundaries | Indiana Geographic Information Office | Parcel geometry for public/community-scale spatial context; not an owner/private-residence engineering anchor. |
| Posey County Changes Since Last FIRM | Indiana geospatial program / local flood mapping | Local flood-map change evidence and reconciliation. |
| The National Map cached basemaps | U.S. Geological Survey | Basemap context for geospatial visualization. |
| USACE hydraulic boundary-condition profile | U.S. Army Corps of Engineers | Controlled hydraulic boundary-condition evidence for engineering workflows. |
| STATS Indiana | Indiana Business Research Center / Indiana University | State demographic/economic/statistical context where explicitly required by an analysis. |
| Indiana Floodplain Information Portal (INFIP) | Indiana DNR Division of Water | Indiana floodplain/floodway regulatory and study discovery. |
| HEC-RAS | U.S. Army Corps of Engineers Hydrologic Engineering Center | Hydraulic model execution/input-output contract; model results remain distinct from regulatory FEMA/Indiana determinations. |
| USGS Flood Inundation Mapper | U.S. Geological Survey | Published inundation scenario/context layer. |
| USGS StreamStats — Indiana | U.S. Geological Survey | Basin delineation and hydrologic/statistical watershed analysis. |
| Indiana DNR Hydrology & Hydraulics Model Library | Indiana DNR | Discover model studies, hydrology/hydraulics references and supporting engineering evidence. |
| Indiana DNR effective flood cross sections | Indiana DNR | Effective cross-section geometry/model evidence for floodway/floodplain review. |
| Indiana coordinated discharges | Indiana DNR | Reference hydrologic design discharges used in applicable hydraulic/floodplain workflows. |

### Additional government/regulatory integrations

The repository also contains contracts or documentation for NWS/NOAA weather services, FEMA FIRM/NFHL products, USACE Louisville District material, USDA NRCS, FHWA, Indiana DNR/INFIP/IGIO, Illinois DNR/ISGS, Kentucky regulatory material, NIST guidance, and federal/state open-data services. These are kept separate from the canonical 21-source Indiana/Federal catalog when they serve a specialized regulatory, evidence, interoperability, or governance purpose.

## Government-data functions implemented by TSM

1. **Hydrologic observation** — retrieve streamflow/gage-height measurements, station metadata, timestamps, units and freshness state; aggregate the community River Watch network; never manufacture missing observations.
2. **Hydrologic forecasting** — bind NOAA/NWS/NWPS forecast context to the appropriate gauge/node while preserving source provenance.
3. **Flood-hazard federation** — display FEMA effective NFHL/FIRM/FIS products, Indiana BAFM/BAFL, DNR studies and other flood evidence as distinct authority planes.
4. **Terrain and elevation** — consume USGS 3DEP and Indiana elevation services, build terrain grids/tiles, calculate hillshade and support source-bound 3D visualization.
5. **Imagery** — consume Indiana current imagery/ArcGIS image services as visual evidence; imagery is not silently promoted to survey-grade engineering data.
6. **Parcel and public-land context** — use current Indiana parcels and PLSS geometry for community-scale spatial context, with explicit privacy boundaries.
7. **Levee and flood-protection evidence** — bind USACE National Levee Database/structure evidence to flood and engineering review workflows.
8. **Hydraulic modeling** — ingest HEC-RAS model geometry with an explicit source CRS, transform to the engineering horizontal frame when authorized, and keep model outputs distinct from regulatory flood determinations.
9. **Cross-section and discharge evidence** — bind Indiana DNR effective cross sections, model libraries and coordinated discharges into evidence-gated workflows.
10. **Watershed analysis** — use USGS StreamStats and inundation products as hydrologic/inundation evidence where applicable.
11. **Regulatory screening** — evaluate documented federal/state rules and evidence requirements without declaring a permit, insurance determination, engineering certification or agency decision.
12. **Provenance and auditability** — attach source authority, dataset/version, retrieval time, CRS/datum, model lineage, software version, uncertainty and integrity evidence to derived records.

## Key runtime services and functions

- **River Watch:** multi-station aggregation, live/stale/candidate/unavailable state handling, USGS/NOAA source binding.
- **Flood federation:** source-authority separation, regulatory-status preservation, CRS/datum metadata, insurance-eligibility metadata and model-lineage tracking.
- **Geospatial fabric:** MapLibre layers, ArcGIS ImageServer/WMS, 3DEP elevation, PMTiles, H3 indexing, 3D Tiles and terrain-grid processing.
- **Terrain processing:** GeoTIFF decoding, terrain-grid sampling, terrain-to-pathfinding conversion, hillshade, Terrain-RGB/Terrarium decoding and live-terrain fallback resolution.
- **Engineering simulation:** deterministic flood scenarios, seeded PRNG, WSE derivation, cross-section profiles, cut/fill volumes, earthwork estimates, dredge sourcing estimates and Section 204 pathway screening.
- **Engineering evidence:** evidence-pipeline validation, required-input gates, human-review gates, deterministic hashing and fail-closed evidence packets.
- **Geodesy:** explicit EPSG registration/transformation contracts, vertical-reference isolation, geodetic chain construction and validation, and provenance sealing.
- **Pathfinding:** A*, Jump Point Search and Theta* over terrain-derived grids.
- **Agriculture/community screening:** field exposure and planting-history summaries without turning private-residence data into engineering triggers.
- **Local AI:** bounded skill-pack routing for flood explanation, evidence summarization and filing proofreading; AI output does not override source authority or human review.
- **Native/desktop runtime:** Windows/native dependency verification, packaging and offline-runtime contracts.

## Geospatial and engineering correctness rules

- HEC-RAS spatial data requires an **explicit source CRS**; TSM does not guess CRS.
- The engineering horizontal frame is **EPSG:2966 (NAD83 / Indiana West, US survey feet)** where that frame is explicitly required.
- **NAVD88 is vertical metadata and is not inferred merely from EPSG:2966.**
- The repository retains a proper `pyproj`-based CRS transformation path. It does **not** replace coordinate transformation with a fake linear EPSG:2966 arithmetic formula.
- Terrain, imagery, flood maps and model outputs retain source identity and regulatory semantics.
- A modeled WSE cannot silently overwrite an effective regulatory BFE.

## Acquisition → validation → integrity → publication chain

Production data publication is accepted only when the complete chain is verifiable:

```text
source acquisition
→ mandatory-source validation
→ strict geometry / schema / CRS validation
→ SHA-256 inventory / manifest
→ artifact upload / publication
→ artifact integrity verification
→ runtime provenance verification
```

The same principle applies to Windows offline runtime artifacts and engineering evidence packages. A successful upload without a matching checksum or provenance record is not treated as a successful release.

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

Posey County source data is **snapshot-first**: the runtime consumes dated, hashed authoritative vintages rather than requiring live agency APIs. Live observations are never implied when a frozen snapshot is being used.

Live observations are **not** emergency instructions. During an active event, official emergency-management and National Weather Service guidance controls.

## Posey County authoritative data model

Posey County is modeled as a **dated authoritative snapshot**, not an open/closed live-data dependency.

- **FEMA:** newest applicable effective NFHL/FIRM/FIS vintage.
- **USGS:** newest available 3DEP terrain/elevation plus New Harmony hydrologic evidence.
- **Indiana DNR:** newest published BAFL/INFIP product.
- **Indiana GIO:** newest available parcel, imagery, and elevation-program product.
- **USACE:** newest per-record National Levee Database evidence plus separately pinned HEC-RAS/model artifacts.
- Every frozen product records its agency identifier, product/vintage date, retrieval time, CRS, vertical datum, model/software version, source URL, and SHA-256.
- Retrieval date is **not** treated as the product vintage.
- Historical products remain comparison evidence and cannot silently override a newer authoritative product.

Authoritative source contract:
`data/posey-county/authoritative-source-vintage-v1.json`

Public console:
https://atphobia22.github.io/Tri-State-Systems-Manager/

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

## Eight-county offline bundle + data catalog API (2026-10-01)

The project now maintains an **11 GB offline data bundle** covering all eight
tri-state counties (Gibson, Posey, Vanderburgh, Warrick IN; Gallatin, White IL;
Henderson, Union KY), wired to the backend via a read-only data catalog API.

### Data catalog endpoints

```text
GET /api/catalog/counties                    — 8 counties + dataset availability
GET /api/catalog/county/{fips}               — file listing + provenance docs
GET /api/catalog/regional                   — multi-county datasets
GET /api/geospatial/county/{fips}/parcels    — parcel GeoJSON (?limit=N)
GET /api/geospatial/county/{fips}/floodplain — flood-zone GeoJSON (?limit=N)
```

Set `OFFLINE_DATA_ROOT` to the bundle path (defaults to
`~/workspace/offline-data`). Missing datasets return 404 with a pointer to
the relevant `MISSING.md`. All responses carry provenance metadata and the
human-review-required disclaimer.

### Bundle contents (highlights)

- **Terrain:** USGS 3DEP 1/3" DEMs (4 tiles), 1m LiDAR DEMs (Posey County),
  EPT indices, KYAPED tile indices
- **Flood:** FEMA NFHL (all counties), Indiana BAFM (IN counties)
- **Parcels:** All counties except Union KY (no public source; documented)
- **Hydrology:** 13-station USGS registry with historical observations
- **Bathymetry:** USGS SIR 2016-5119 (Wabash at New Harmony) + 20 USACE
  eHydro Ohio River surveys (RM 776–976, 1.4 GB) + ERDC/CHL TR-22-4
  confluence report
- **Hydraulics:** HEC-RAS 7.0 example projects + St. Joseph River model

### Illinois counties (Gallatin 17059, White 17193)

- **Parcels:** White County via EagleView-hosted ArcGIS (20,956 features,
  owner fields stripped); Gallatin County public-safe parcels
- **Flood:** FEMA NFHL via Esri derived-NFHL copy (Illinois NFHL not
  directly downloadable)
- **Imagery:** NAIP scene indices via Planetary Computer STAC (574 tiles
  cataloged for White County across 12 vintages; full download = 100+ GB,
  indices retained)
- **Terrain:** Covered by 3DEP 1° DEMs (n37w088, n38w088)
- **TIGER:** 2024 roads + area water

### Kentucky counties (Henderson 21101, Union 21225)

- **Parcels:** Henderson County via county AGOL org (22,822 features, no
  owner fields by source design); **Union County parcels unavailable** —
  KY DOR PVA license incompatible with persistent bundle (contact Union
  County PVA, Clay Wells, 270-389-1933, or qPublic subscription)
- **Flood:** FEMA NFHL (Henderson direct; Union via recovery workflow);
  KY DOW DFIRM detailed + approximate studies
- **Elevation:** KYAPED 5 ft DEM / point cloud / aerial tile indices
  (Henderson: 839 tiles; Union: 660 tiles; indices only, not bulk download)
- **Terrain:** Covered by 3DEP 1° DEM (n37w087)
- **TIGER:** 2024 roads + area water

### 13-station gauge registry

USGS 03378500 = **Wabash River at New Harmony, IN** (38.13089124, -87.9414145).
USGS 03377500 = **Wabash River at Mt. Carmel, IL** (38.3983333, -87.75638889).
Verified against USGS Water Services 2026-10-02. Live observations only via
user-initiated `POST /api/hydrologic/snapshot` — no automatic polling.

### Engineering roadmap (13 items)

The `roadmap/` directory in the offline bundle documents the complete
engineering workflow: 01 Authoritative Terrain → 02 Verified Bathymetry →
03 Datum Control → 04 Baseline HEC-RAS → 05 Calibrated Hydraulics →
06 Alternative Scenarios → 07 Independent Earthwork → 08 Sediment Suitability
→ 09 Environmental Screening → 10 Agency Eligibility → 11 Benefit-Cost Analysis
→ 12 Funding Application → 13 QA/QC.

### Missing-source recovery

`.github/workflows/missing-source-recovery.yml` acquires unavailable datasets
from authoritative endpoints (ArcGIS, FEMA NFHL) with SHA-256 verification
and fail-closed validation. See `docs/MISSING-SOURCE-RECOVERY.md`.

## Posey County offline authoritative acquisition (2026-09-30)

The repository now contains a reproducible government-source acquisition path for Posey County (FIPS 18129):

- scripts/posey/download-offline-authoritative-data.ps1 downloads county-scoped FEMA NFHL/FIRM data, Indiana DNR BAFL, Indiana GIO 2025 parcels and imagery/tier metadata, USACE NLD, USGS New Harmony history, the published USGS SIR 2016-5119 study package, NOAA/USGS 2017–2020 lidar metadata/EPT indexes, and the current USGS 3DEP Posey product index.
- .github/workflows/posey-offline-data.yml packages the acquired snapshot and publishes a SHA-256-verified GitHub Actions artifact.
- data/posey-county/offline/2026-09-30/acquisition-manifest-v1.json is the machine-readable acquisition contract.
- data/posey-county/offline/2026-09-30/fema-effective-firm-panels-18129C.json freezes all 35 effective Posey panels and the 2014-11-05 effective date.

Large raw 3DEP point-cloud and statewide imagery products are not silently copied into source control. The offline bundle freezes their official product/service indexes and exact asset endpoints; raw LAZ/raster extraction is performed from those endpoints on a networked acquisition host and hashed in the download receipt.
