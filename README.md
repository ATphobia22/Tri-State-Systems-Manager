# Tri-State Systems Manager (TSM)

**Community-scale engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley.**

TSM combines authoritative river observations, geospatial evidence, engineering-model contracts, provenance, uncertainty and human review into an auditable decision-support system for communities, farms, transportation corridors, flood-resilience projects and public agencies. TSM is not a substitute for licensed engineering, surveying, regulatory review, emergency management, or other professional authority.

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## Current production status

| Surface | Location |
|---------|----------|
| **Primary branch** | `main` |
| **Public console (GitHub Pages SPA)** | https://atphobia22.github.io/Tri-State-Systems-Manager/ |
| **Production API (Coolify/self-hosted)** | https://<your-tsm-api-domain> |
| **API readiness** | `GET /ready` — deployed Git SHA, `auth_ready`, OIDC readiness |
| **Console package** | `tsm-console` **v0.2.1** (React **19.3.0**, Vite 8, `@react-three/fiber` **9.8.1**, MapLibre **6.10.0**) |

**Verified (2026-09-27):** Actions production build → Pages preflight → deploy → live HTTP check. The published site serves the **Vite SPA** (module entry under `/Tri-State-Systems-Manager/assets/`, MapLibre vendors, document CSP) — not a Jekyll/README fallback.

Deployment provenance is fail-closed: a browser deployment is not considered verified when the live API serves a different build SHA from the release being published.

Required repository configuration for Pages deploy:

```text
VITE_TSM_API_BASE_URL=https://<your-tsm-api-domain>
```

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

Notable workflows: `ci.yml`, `deploy-pages.yml`, `tsm-parse-gate.yml`, `codeql.yml`, `open-world-twin.yml`, `ptdt-e2e-visual.yml`, `container-ci.yml`, `tsm-desktop.yml`, `deploy-coolify.yml`.

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
