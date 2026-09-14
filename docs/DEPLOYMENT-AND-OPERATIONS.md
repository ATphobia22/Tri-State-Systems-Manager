# Tri-State Systems Manager — Deployment and Operations

## Production boundary

TSM has two runtime planes:

1. **Browser console** — Vite-built static application.
2. **Node API** — authoritative-source adapters, hydrologic aggregation, evidence services and engineering endpoints.

GitHub Pages can host the static browser plane, but it cannot execute the Node API. A deployment that needs live river observations must publish the Node API over HTTPS and set `VITE_TSM_API_BASE_URL` to that API origin at frontend build time.

## Container deployment

From `tsm-console/`:

```bash
docker compose up --build
```

The local stack exposes:

- Web console: `http://localhost:3000`
- API: `http://localhost:8787`
- API readiness: `http://localhost:8787/ready`
- Community river observations: `http://localhost:8787/api/hydrologic/community`

The web container uses `VITE_TSM_API_BASE_URL=http://localhost:8787`. For a hosted environment, replace it with the HTTPS API origin and set `CORS_ORIGIN` to the exact HTTPS browser origin.

## Build-only deployment

```bash
cd tsm-console
npm ci
npm run ci:full
npm run build
npm run preview
```

CI is the authoritative repository verification environment when a local Node toolchain is unavailable. Do not bypass failing integrity, security, provenance, typecheck, build or test gates.

## Live River Watch

The browser uses `/api/hydrologic/community`, which performs server-side aggregation against the registered USGS/NOAA sources. Each observation retains source identity, observed time, retrieval time, qualifier, discharge where available, freshness state and source URI.

The UI deliberately shows `LIVE OBSERVATION`, `STALE`, `CANDIDATE — NOT LIVE`, or `SOURCE UNAVAILABLE`; it never substitutes a guessed value for a missing upstream observation.

## Engineering evidence

Engineering model outputs are not regulatory determinations. Before construction, a qualified engineer must verify survey control, geotechnical investigation, groundwater/pore pressure, material qualification, hydraulic boundary conditions, project geometry, stability/settlement/scour analyses and applicable agency approvals.

Dredged material is not presumed to be structural fill. Section 204 is not presumed to fund a road or berm. Those are project-specific authority, environmental, material and engineering determinations.

## Privacy

The public application is community-scoped. Do not add private residence addresses, parcel identifiers, account credentials, sealed survey information or house-specific engineering targets to public runtime contracts, manifests or UI components.

## Operational checks

Before release, verify:

- `/ready` returns `ready: true`.
- `/api/hydrologic/community` returns a registry version and per-station provenance.
- upstream failures remain explicit and do not become synthetic observations.
- `npm run check:type`, `npm run build` and `npm run test:all` succeed in CI.
- production browser configuration points to the intended HTTPS API.
- `CORS_ORIGIN` is restricted to the intended browser origin.
- no secrets are committed or exposed to the browser.
- the deployed commit SHA is recorded with the release evidence.

## Safety and authority

TSM is decision support. It does not replace the responsible floodplain administrator, agency, licensed professional engineer/surveyor, emergency management authority, environmental review, or official flood/emergency instructions.
