# Omni-Ecosystem Canvas — Prototype Resync (2026-08-20)

Source: legacy Master Omni-Ecosystem Canvas prototype.

## Critical corrections

| Prototype claim | Authoritative TSM | Action |
|-----------------|-------------------|--------|
| **EPSG:2967** | **EPSG:2966** (NAD83 / Indiana West, US ft) | **REJECT 2967** — keep 2966 |
| NAVD88 vertical | NAVD88 | KEEP |
| BFE 375.0 / LAG 377.2 / FFE 382.5 | Same | KEEP |
| Parcel/APN | Source-required; never hard-coded | REJECT |
| USGS 03378500 Wabash @ New Harmony | Same (provisional data) | KEEP |
| Mapillary `mlly_mock_token` / mock imageKey | Not live authority | Label **SIMULATION_DEMO** |
| WSE slider driving Three.js water mesh | Visualization only | **VISUALIZATION** / not regulatory stage |
| PyScript datetime print | Demo only | Not Scientific Plane |

Horizontal CRS must never be written as 2967 in TSM configs or UI copy.

## Subsystem → four-plane mapping

| Canvas tab | TSM plane | Integration rule |
|------------|-----------|------------------|
| **Community Heritage Archive** | Governance / Charter | Community stewardship material only; no private-person records |
| **PTDT v35** | Evidence + Visualization + Simulation | MapLibre + TwinCanvas; stage from USGS/NWPS loaders; Three water = demo |
| **TMRDS (Medical AI)** | **Out of public Evidence plane** | Separate product boundary; no clinical claims in public TSM; no PHI in ledger |
| **Energy & Resilience Scenarios** | Benefit / Scientific scenario | Product/energy plans as MODEL_OUTPUT or external product DB — not floodway truth |
| **Cinematic Engine** | Visualization | Export overlays from model outputs; ACEScg pipeline is media, not regulation |

## Reusable UI patterns (safe to port)

- HUD panel / monospace status aesthetic → already aligned with Trust Fabric bar
- Subsystem sidebar → maps to React Router routes (Charter, Map, Ledger, Benefit, Lineage)
- Local event log (50 lines) → optional EOC terminal; not a substitute for Merkle ledger
- “Seal Ledger State” button → must call **server** Merkle append, never client-only SHA theatre

## Explicit non-integration

- AlphaFold / Qiskit / USMLE RAG panels as “live” medical systems
- Mock industrial Modbus as real PLC telemetry without evidence workers
- CDN React 18 + Babel in-browser as production architecture (TSM uses Vite + RR v7)
- Mapillary without a real access token and image keys in Authority Registry

## Community site constants

```text
CRS horizontal: EPSG:2966
Vertical:       NAVD88
Project-specific elevations: SOURCE_REQUIRED
Parcel/APN:     SOURCE_REQUIRED
Gauge:          USGS 03378500
```

