# Tri-State Systems Manager (TSM)

**Community-scale engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley.**

TSM combines authoritative river observations, geospatial evidence, engineering-model contracts, provenance, uncertainty and human review into an auditable decision-support system for communities, farms, transportation corridors, flood-resilience projects and public agencies. TSM is not a substitute for licensed engineering, surveying, regulatory review, emergency management, or other professional authority.

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## What is deployable

TSM has two runtime planes:

- **Web console:** React 19 + TypeScript + Vite + MapLibre + Three.js.
- **Node API:** authoritative-source adapters, multi-gauge aggregation, evidence storage/verification, geospatial services and engineering endpoints.

The browser and API are intentionally separately deployable. GitHub Pages can host the static browser plane; live river observations require the Node API to be published over HTTPS and selected with `VITE_TSM_API_BASE_URL`.

The Open World Twin geospatial plane also integrates:

- Indiana current imagery through the current ArcGIS ImageServer/WMS fabric;
- USGS 3DEP elevation/hillshade visualization;
- Indiana current and 2025 parcel services;
- FEMA NFHL and Indiana BAFM as separate flood-authority planes;
- USGS/NOAA live hydrologic observations;
- historical Point Township plat/FIRM material as reference-only evidence;
- H3 spatial indexing (`h3-js` 4.5.0) for bounded spatial aggregation;
- PMTiles archive access (`pmtiles` 4.5.0) for portable tiled-data distribution;
- NASA-AMMOS `3d-tiles-renderer` 0.5.2 for browser-side 3D Tiles visualization;
- Protomaps basemap generation as a governed OSM/Natural Earth pipeline, with required OSM attribution.

The live imagery and 3DEP visual layers are source-bound visualization products. They do **not** silently become survey-grade terrain, regulatory determinations or engineering design surfaces. MapLibre 3D terrain remains fail-closed behind the configured `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` contract until a materialized, provenance-controlled Terrain-RGB/raster-dem service is available.

## Community River Watch

The River Watch uses the registered USGS/NOAA station fabric and displays measured observations with explicit provenance and freshness states. The current network includes New Harmony, Evansville, Newburgh, Old Shawneetown, Smithland, Cannelton, Olmsted, Markland, McAlpine and Louisville. J.T. Myers is retained as a candidate station until its live runtime availability is independently verified.

The system never converts a missing upstream observation into a guessed value. `LIVE OBSERVATION`, `STALE`, `CANDIDATE — NOT LIVE`, and `SOURCE UNAVAILABLE` are distinct states.

API endpoint:

```text
GET /api/hydrologic/community
```

## Engineering evidence

TSM separates:

1. external observation;
2. derived calculation;
3. model input;
4. model output;
5. engineering-review-ready evidence;
6. engineer acceptance;
7. agency acceptance.

The engineering section shows the chain from existing ground/survey through subsurface investigation, foundation preparation, drainage, qualified engineered fill and finished road/berm geometry. Missing survey, geotechnical, hydraulic or laboratory evidence remains visible rather than being fabricated.

Dredged material is **not presumed** to be structural fill. USACE Section 204 is a **conditional authority pathway**, not automatic road funding or a guarantee of material availability. Material qualification, environmental review, project purpose, cost share and agency approval remain project-specific.

### Evidence-gated engineering pipeline

The canonical engineering workflow is deliberately ordered so downstream artifacts cannot manufacture missing upstream evidence:

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

Each stage carries explicit provenance, status and evidence requirements. A model result is not a survey, a cut/fill balance is not geotechnical acceptance, a BCA is not agency eligibility, and a funding rule is not a funding award. Missing or unverified evidence remains **blocked/unknown** rather than being inferred.

The machine-readable contract is maintained in `data/engineering/evidence-pipeline-contract.json`, with its schema in `data/schemas/engineering-evidence-pipeline-v1.schema.json`. CI validates the gate with `npm run check:engineering-pipeline`.

## Data and authority hierarchy

Primary-source government products are preferred:

- USGS Water Data / streamgages
- NOAA/NWS NWPS
- USACE Louisville District and Beneficial Use Program
- FEMA NFHL/FIRM/FIS products
- Indiana DNR Division of Water and BAFM/INFIP
- USGS 3DEP and Indiana geospatial products
- USDA NRCS watershed/soil programs
- FHWA transportation-resilience programs
- NIST security/AI governance references

Community historical records are preserved as historical evidence and are never silently promoted to agency observations.

## Hydrologic datum rule

Raw gage height remains in its source-product datum. A NAVD88 water-surface elevation is derived only when a validated, product-matched gage-zero conversion is available.

```text
WSE_NAVD88 = source_gage_height + validated_gage_zero_NAVD88
```

Source station, parameter, observation time, units, datum, conversion metadata and provenance travel with the derived record.

## Privacy boundary

The public architecture is community-scoped. It does **not** use a private residence, parcel/APN, owner record, account identifier or house-specific flood trigger as an engineering anchor.

Private cadastral and residence-specific artifacts were removed from the active public repository surface. Community engineering may still use generalized historical evidence and authoritative regional datasets.

## Repository map

```text
.github/workflows/      CI/CD and policy enforcement
backend/                Python server-side domain helpers
data/                   schemas, registries and controlled evidence
db/                     persistence definitions
docs/                   engineering, deployment, governance and research records
packages/               shared contracts
scripts/                CI, ingestion and GIS tooling
tools/                  specialized engineering/data tools
tsm-console/            React/Vite console + Node API + tests
```

Important runtime files:

- `tsm-console/src/lib/river-gauges.ts` — community gauge definitions and client contract
- `tsm-console/server/ingestion/river-network-api.mjs` — server-side multi-gauge aggregation
- `tsm-console/server/token-proxy.mjs` — Node API
- `tsm-console/src/components/RiverGaugeBoard.tsx` — accessible River Watch display
- `tsm-console/src/components/EngineeringSectionCutaway.tsx` — engineering vertical section visualization
- `artifacts/tsm-river-valley-realtime-stations-v1.json` — station/structure registry
- `artifacts/tsm-geospatial-tile-fabric-v1.json` — governed live/historical geospatial asset manifest
- `artifacts/tsm-regulatory-gates-v1.json` — regulatory review gates
- `docs/OPEN-WORLD-LIVE-TILE-FABRIC-v1.md` — live imagery/elevation/Open World tile architecture
- `docs/DEPLOYMENT-AND-OPERATIONS.md` — deployment and operations runbook
- `COMPLIANCE.md` — authority and non-certification boundaries

## Local deployment

### Native Node

```bash
cd tsm-console
npm ci
npm run ci:full
npm run dev
```

Production-equivalent browser build:

```bash
npm run build
npm run preview
```

### Docker

```bash
cd tsm-console
docker compose up --build
```

Then use:

- Web: `http://localhost:3000`
- API: `http://localhost:8787`
- Readiness: `http://localhost:8787/ready`
- River Watch API: `http://localhost:8787/api/hydrologic/community`

For hosted deployment, set the browser build variable `VITE_TSM_API_BASE_URL` to the HTTPS API origin and restrict `CORS_ORIGIN` to the exact HTTPS web origin.

## CI, actions and deployment verification

The canonical application validation sequence is:

```bash
cd tsm-console
npm run ci:full
```

The main CI workflow additionally validates backend engineering primitives and the monitoring configuration. Alertmanager and Prometheus checks invoke their bundled `amtool`/`promtool` binaries explicitly and use version-pinned container digests; they must not rely on the monitoring images' server entrypoints or floating `:latest` tags.

The GitHub Pages workflow always performs the production build and uploads a normal production artifact. The actual Pages deployment is intentionally conditional on the repository variable:

```text
TSM_PAGES_ENABLED=true
```

When that variable is not enabled, the production build remains verified and the Pages deployment job is skipped rather than falsely reporting a deployment. Enabling Pages also requires GitHub repository Pages configuration; the workflow does not fabricate or bypass that repository-level setting.

The CI suite includes dependency integrity, supply-chain policy, SBOM/provenance, repository integrity, workflow security, artifact contracts, quantum isolation, shell safety, source-data contracts, parsing, TypeScript, geospatial validation, production build and the full test suite.

Do not weaken or bypass a failing gate.

## Safety and professional authority

TSM is an engineering decision-support and evidence system. It does not certify a berm, road, bridge, levee, floodway analysis, survey, geotechnical report, environmental determination or regulatory filing. Construction decisions require the responsible licensed professionals and applicable federal, state and local authorities.

Likewise, live observations are not emergency instructions. During an active event, official emergency-management and National Weather Service instructions control.

## Geospatial toolchain and licensing boundaries

The governed open-source geospatial toolchain is recorded in `tsm-console/config/geospatial_toolchain.json`. Current browser integrations include `h3-js` 4.5.0 (Apache-2.0), `pmtiles` 4.5.0 (BSD-3-Clause), and `3d-tiles-renderer` 0.5.2 (Apache-2.0). Protomaps basemap generation is retained as a reproducible source pipeline; OSM-derived tiles require the applicable ODbL attribution. AI segmentation via SamGeo/`segment-geospatial` remains human-review-required, and ToolJet remains process-isolated because of its AGPL licensing boundary. Visualization libraries do not acquire engineering authority merely by rendering an authoritative dataset.

## Production-readiness controls added in v35 hardening

### Frontend loading and rendering

The router already uses route-level dynamic imports for the heavy spatial views (TwinCanvasView, MapLibreEocView, MapLibreMap, and MapTwinView). A source-level regression contract prevents those modules from becoming eager router imports again.

Hardware capability detection is explicit:

WebGPU → WebGL2 → Canvas 2D

The application must remain usable without WebGPU. The 3D terrain mesh remains fail-closed when a provenance-controlled Terrain-RGB/raster-dem source is not configured.

### Authentication and browser environment

Keycloak is configured as a public browser client using Authorization Code + PKCE (S256). The canonical public build variables are:

- VITE_KEYCLOAK_URL
- VITE_KEYCLOAK_REALM
- VITE_KEYCLOAK_CLIENT_ID
- VITE_IDP_REDIRECT_URI

No client secret belongs in a VITE_* variable.

For GitHub Pages production builds, these values plus VITE_TSM_API_BASE_URL are supplied from repository Variables. When Pages deployment is enabled, the workflow fails closed if the required browser bindings are absent.

### Content Security Policy

Vite now injects a deployment-aware CSP covering:

- WebAssembly via wasm-unsafe-eval without enabling general unsafe-eval;
- MapLibre/Web Worker blob: workers;
- USGS, NOAA/NWS, FEMA, Indiana ArcGIS and OpenStreetMap connections;
- the configured Keycloak origin;
- object-src 'none' and explicit base-uri, form-action, image, font and media policies.

GitHub Pages is a static host; HTTP response headers remain the responsibility of the hosting/reverse-proxy layer. The build therefore also carries the CSP as a document-level policy.

### Live hydrology resilience

The Node ingestion fabric now combines:

- bounded request timeouts;
- retry/backoff and Retry-After handling;
- circuit breaking;
- source-health telemetry;
- bounded last-known-good cache;
- explicit STALE responses when upstream sources are unavailable.

A stale observation is never relabeled as live. If no valid cached observation exists, the API returns an explicit unavailable response.

### Vertical datum reconciliation

A dedicated normalization middleware now accepts only:

- source datum;
- target datum;
- numeric transformation offset; and
- provenance for the published transformation.

Identity conversions are permitted. NGVD29/gage-zero/local-datum conversions without a supplied, station/product-specific published transformation are blocked, not guessed.

USGS documentation recognizes that gages can use NAVD88, NGVD29, or an arbitrary gage datum; therefore a raw gage-height value must not be silently relabeled as NAVD88.

### Event bus

A fail-closed Kafka REST Proxy-compatible telemetry bridge is available behind:

TSM_EVENT_BUS_ENABLED=true

Configuration remains server-side:

- TSM_KAFKA_REST_URL
- TSM_KAFKA_TOPIC
- TSM_KAFKA_USERNAME
- TSM_KAFKA_PASSWORD

Hydrologic observations publish normalized, provenance-linked events. Event-bus outages do not corrupt the authoritative source artifact; the source observation remains independently recorded and the event result is reported separately.

### FEMA panel 18129C0265C

A dedicated BFE reconciliation contract now rejects mismatches between an authoritative FEMA BFE evidence value and the hydraulic mesh BFE value. The contract requires NAVD88 and source provenance.

The repository's existing panel evidence remains fail-closed until the exact matching authoritative world/georeferencing artifact and current FEMA source metadata are available. The contract does not fabricate a panel BFE from a screenshot.

### FEMA LOMC / LOMA evidence packet

tools/loma/build_loma_packet.py assembles supplied evidence files into:

- a SHA-256 manifest;
- a deterministic evidence-index PDF;
- a ZIP packet containing the manifest, PDF and supplied source files.

scripts/evidence/sign-evidence.mjs provides detached Ed25519 signing when the operator supplies TSM_EVIDENCE_SIGNING_KEY_PEM. Signing keys are never committed.

The packet builder intentionally does not generate a survey, FARA, FEMA determination, community acknowledgment, engineering certification or regulatory approval.

### Databricks lakehouse CD

.github/workflows/databricks-lakehouse.yml defines an OIDC-gated production deployment contract. It is disabled until repository variable TSM_DATABRICKS_ENABLED=true.

Required production environment variables:

- DATABRICKS_HOST
- DATABRICKS_CLIENT_ID

The workflow uses GitHub OIDC workload identity federation rather than a long-lived Databricks PAT/client secret and verifies the pinned Databricks CLI release before installation.

See docs/DATABRICKS-CI-CD.md.

### Current geospatial CRS and vertical-datum boundary

The TSM horizontal engineering analysis frame is **EPSG:2966 (NAD83 / Indiana West, US survey feet)**. EPSG:2966 is a horizontal projected CRS; **NAVD88 is not encoded by EPSG:2966 and is therefore tracked separately as vertical-reference metadata**. Native government services may legitimately expose other CRSs (for example, Indiana BAFM's native service CRS or Web Mercator imagery/elevation services); those coordinates must be explicitly transformed before entering the TSM engineering frame.

A NAVD88 elevation or water-surface value is accepted only when its source/product-specific vertical reference or a validated transformation is documented. TSM does not infer NAVD88 merely because a layer is an elevation product. USGS 3DEP source catalog records can explicitly declare NAVD88 for individual source products, demonstrating why the datum must remain source metadata rather than an assumption applied to every raster. citeturn0search2

A geospatial audit found and corrected the HEC-RAS project contract's erroneous EPSG:26916 declaration to EPSG:2966.

## Open-World Twin: visual and cinematic layer contract

The Twin treats visualization as a governed rendering plane rather than a source of truth. The current visual stack is designed around explicit source state:

1. **Terrain** — source-derived elevation, rendered through MapLibre terrain when a verified Terrain-RGB/raster-dem source is configured.
2. **Current imagery** — authoritative Indiana imagery source, kept distinct from elevation.
3. **Parcels** — Martin/PostGIS vector tiles with provenance attributes; geometry and evidence remain separate from hydraulic model output.
4. **FEMA effective flood hazards** — regulatory reference layer, never replaced by simulated WSE.
5. **Indiana BAFM/INFIP** — state floodplain mapping reference plane.
6. **Hydraulic scenario output** — model WSE displayed as MODEL_OUTPUT and subject to review; it is not silently promoted to FEMA regulatory evidence.
7. **Live hydrology** — USGS/NOAA observations with freshness and datum state.
8. **Historical evidence** — clearly labeled historical/reference material.
9. **Atmosphere and lighting** — sky, fog, illumination and terrain exaggeration are presentation parameters only and never alter source values.
10. **Cinematic camera** — an interruptible confluence fly-through is available from the Twin UI. Camera motion is non-authoritative and can be stopped by the operator.

### Vertical-data rule

Terrain-RGB is encoded in meters and must be generated from an elevation raster whose vertical datum has already been verified. The renderer does not infer NAVD88 from an arbitrary raster or orthophoto. Orthophotography is color imagery, not elevation.

### Engineering/model boundary

FEMA BFE, flood-zone evidence, observed stage, datum-converted WSE, and HEC-RAS scenario WSE are different data products. They must remain different records, schemas and visual states. A scenario may be compared with regulatory evidence, but it may not overwrite it.

### Visual quality without fabricated data

The project supports cinematic presentation—terrain, current imagery, atmospheric sky/fog, lighting, 3D extrusion and camera tours—while retaining fail-closed behavior when authoritative source material is absent. No placeholder tile provider, invented BFE, synthetic insurance premium, guessed datum conversion, or fabricated 3D terrain is promoted to production truth.

### Evidence and signing

Audit/evidence signatures use canonical JSON and Ed25519 with externally supplied private keys. A valid signature establishes authenticity/tamper evidence for the signed record; immutable storage and retention controls are separate infrastructure responsibilities.

## Development acceptance checklist

Before calling a release production-ready, verify all of the following:

- [ ] `npm run ci:full` passes from a clean checkout.
- [ ] Browser build contains no credentials or signing keys.
- [ ] Terrain source metadata identifies horizontal CRS, vertical datum, resolution and provenance.
- [ ] FEMA/BAFM layers retain authoritative source identity and effective/acquisition metadata.
- [ ] Model WSE records contain scenario/model/version/datum/timestep/evidence metadata.
- [ ] Regulatory BFE records cannot be overwritten by model ingestion.
- [ ] Martin routes and source-layer identifiers match the deployed server configuration.
- [ ] Current imagery and terrain are independently validated.
- [ ] Live hydrology freshness and datum states are visible.
- [ ] Cinematic controls are cancellable and do not mutate source data.
- [ ] Evidence signatures verify against an independently retained public key.
- [ ] Immutable evidence retention is configured for the deployment environment.
- [ ] Production deployment uses pinned dependencies/images and documented secrets management.
