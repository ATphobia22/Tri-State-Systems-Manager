# Tri-State Systems Manager (TSM)

**Community-scale engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley.**

TSM combines authoritative river observations, geospatial evidence, engineering-model contracts, provenance, uncertainty and human review into one auditable system for communities, farms, transportation corridors, flood-resilience projects and public agencies.

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## What is deployable

TSM has two runtime planes:

- **Web console:** React 19 + TypeScript + Vite + MapLibre + Three.js.
- **Node API:** authoritative-source adapters, multi-gauge aggregation, evidence storage/verification, geospatial services and engineering endpoints.

The browser and API are intentionally separately deployable. GitHub Pages can host the static browser plane; live river observations require the Node API to be published over HTTPS and selected with `VITE_TSM_API_BASE_URL`.

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
- `artifacts/tsm-regulatory-gates-v1.json` — regulatory review gates
- `docs/engineering/TSM-ENGINEERING-EVIDENCE-REPORT.tex` — reproducible LaTeX evidence template
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

## Verification

The canonical CI sequence is:

```bash
npm run ci:full
```

It includes dependency integrity, supply-chain policy, SBOM/provenance, repository integrity, workflow security, artifact contracts, quantum isolation, shell safety, source-data contracts, parsing, TypeScript, geospatial validation, production build and the full test suite.

Do not weaken or bypass a failing gate.

## Safety and professional authority

TSM is an engineering decision-support and evidence system. It does not certify a berm, road, bridge, levee, floodway analysis, survey, geotechnical report, environmental determination or regulatory filing. Construction decisions require the responsible licensed professionals and applicable federal, state and local authorities.

Likewise, live observations are not emergency instructions. During an active event, official emergency-management and National Weather Service instructions control.
