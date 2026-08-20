# Omni-Ecosystem Canvas — Prototype Resync (2026-08-20)

Source: Tucker Inc. 82 Master Omni-Ecosystem Canvas (single-file React+CDN prototype).

## Critical corrections

| Prototype claim | Authoritative TSM | Action |
|-----------------|-------------------|--------|
| **EPSG:2967** | **EPSG:2966** (NAD83 / Indiana West, US ft) | **REJECT 2967** — keep 2966 |
| NAVD88 vertical | NAVD88 | KEEP |
| BFE 375.0 / LAG 377.2 / FFE 382.5 | Same | KEEP |
| APN 65-19-08-100-008.001-010 | Same | KEEP |
| USGS 03378500 Wabash @ New Harmony | Same (provisional data) | KEEP |
| Mapillary `mlly_mock_token` / mock imageKey | Not live authority | Label **SIMULATION_DEMO** |
| WSE slider driving Three.js water mesh | Visualization only | **VISUALIZATION** / not regulatory stage |
| PyScript datetime print | Demo only | Not Scientific Plane |

Horizontal CRS must never be written as 2967 in TSM configs or UI copy.

## Subsystem → four-plane mapping

| Canvas tab | TSM plane | Integration rule |
|------------|-----------|------------------|
| **Family Heritage Vault** | Governance / Charter | Memorial charter, Lineage view — **no** PHI; RUFADAA only if user supplies legal basis |
| **PTDT v35** | Evidence + Visualization + Simulation | MapLibre + TwinCanvas; stage from USGS/NWPS loaders; Three water = demo |
| **TMRDS (Medical AI)** | **Out of public Evidence plane** | Separate product boundary; no clinical claims in public TSM; no PHI in ledger |
| **Tucker Power & PCM** | Benefit / Scientific scenario | Product/energy plans as MODEL_OUTPUT or external product DB — not floodway truth |
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

## Site constants (canonical)

```
CRS horizontal: EPSG:2966
Vertical:       NAVD88
BFE:            375.0 ft
LAG:            377.2 ft
FFE:            382.5 ft
Berm crest:     379.8 ft (from prior TSM constants)
APN:            65-19-08-100-008.001-010
Gauge:          USGS 03378500
```

