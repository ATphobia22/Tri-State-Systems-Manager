# TSM Four-Plane Architecture (ADR-005)

> Human-readable rendering of the canonical machine-readable plane map
> [`data/schemas/tsm-four-plane-architecture-v1.json`](../data/schemas/tsm-four-plane-architecture-v1.json).
> The JSON is authoritative; this document is derived from it. Do not edit
> the plane definitions here — edit the JSON and re-render.

Decision: **FULL_STACK** (approved 2026-08-19, v1.0.0)

Repository becomes the complete Tri-State Systems Manager including ingestion workers, evidence ledger, APIs, and public client. Current React console is the first operational client — not the source of scientific truth.

## Plane 1: Evidence & Data Governance Plane

*authoritative*

Owns:

- USGS NWIS / NOAA NWPS ingestion
- Indiana GIO / 3DEP imagery and elevation
- FEMA NFHL / INFIP / cadastral sources
- immutable source snapshots
- SHA-256 content addressing
- provenance manifests
- validation and freshness states
- fail-closed ingestion

## Plane 2: Scientific & Simulation Plane

*non-authoritative*

Owns:

- versioned model inputs
- explicit uncertainty propagation
- HAZUS/BCA as traceable model adapters
- explicit CRS/datum transformations
- derived geometry tagged DERIVED not AUTHORITATIVE

## Plane 3: Governance & Decision Plane

*authoritative*

Owns:

- IN/IL/KY jurisdiction profiles
- federal overlays
- versioned machine-readable policies
- human approval gates
- AI governance and model cards
- evidence ledger adjudication
- public accountability/audit trail

- **Rule:** No AI-generated result silently becomes a regulatory determination
- **Rule:** FRE 702 is an evidentiary framework — not a claim that a hash makes evidence admissible
- **Rule:** BCA ratios and HAZUS losses require source/version/assumptions provenance

## Plane 4: Public Experience / Visualization Plane

*non-authoritative; client may own*

Owns:

- MapLibre / WebGPU / R3F clients
- 2D/3D terrain and cross sections
- telemetry displays
- accessibility-first interfaces
- low-bandwidth/public mode
- downloadable evidence packages
- source provenance visible in UI

Note: Current tsm-console lives here

## Critical prototype corrections

- Math.random forbidden for evidence IDs/hashes — use crypto
- Displayed 0x... values must be real SHA-256 hex (64 chars) or labeled non-hash
- Client-side state is cache/demo only — not immutable ledger
- Hard-coded sensor values labeled SIMULATION_DEMO
- USGS/NOAA/GIO claims require actual endpoint ingestion
- EPSG:2966 and NAVD88 are separate: horizontal CRS vs vertical datum
- Jurisdiction rules need authoritative-source verification before compliance logic
- Water-stage slider is visualization control — not engineering prediction
- HAZUS/BCA hard-coded numbers require provenance or demo label
- Frontend never owns authoritative regulatory/evidence state
