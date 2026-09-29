# External Capability Runtime

## OSRM

Provide a provenance-tracked `.osrm` dataset at `/data/region.osrm`, run `ops/osrm-routing.Dockerfile` as an isolated routing service, and set `TSM_OSRM_BASE_URL=http://osrm:5000`. Routing responses are `DERIVED` and are never promoted to regulatory evidence.

## CadQuery

Build `ops/cadquery-worker.Dockerfile` only for an isolated engineering worker. The worker accepts only allowlisted primitive geometry operations and emits SHA-256-bound artifacts.

## MapLibre-Geoman

Install the selected Geoman distribution in the frontend deployment and inject its constructor into `attachDraftGeometryAuthoring`. Draft geometry remains `DRAFT` until it passes TSM human-review/provenance workflow.

## 3D Tiles

CI installs pinned `3d-tiles-tools` and `3d-tiles-validator` without changing the application lockfile. This keeps tooling separate from the production browser bundle.
