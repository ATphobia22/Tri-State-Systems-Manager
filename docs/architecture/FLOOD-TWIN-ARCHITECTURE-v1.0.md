# Flood twin architecture — Tri-State Systems Manager

**Version:** 1.0 · **Date:** 2026-10-17  
**Principle:** Technology informs people; it does not silently govern people. Human authority remains final.

## 1. What TSM is (and is not)

| Claim | TSM |
|-------|-----|
| Digital **model** (static sources) | Yes — FEMA NFHL, Indiana BAFM, terrain tiles, parcels |
| Digital **shadow** (physical → virtual, on demand) | Yes — button-only USGS stages |
| Digital **twin** (bidirectional control of physical systems) | **No** |
| CityGML **LOD4** interiors | **No** |
| Continuous live **4D** product default | **No** |
| Maturity **Level-5 autonomous** | **No** (ADR-004 / ADR-006 S1) |

Honest product name: **evidence-governed digital shadow + scenario workspace**.

## 2. Four-plane architecture (ADR-005)

```text
┌─────────────────────────────────────────────────────────────────┐
│ PUBLIC VISUALIZATION                                            │
│  MapLibre Twin Canvas · Scenario Studio · 3D Tiles (DERIVED)    │
│  Labels: OBSERVED | DERIVED | SCENARIO | REGULATORY | SIM_DEMO  │
├─────────────────────────────────────────────────────────────────┤
│ GOVERNANCE / DECISION                                           │
│  Human review · S1 agents default · S2 gated · no silent act    │
├─────────────────────────────────────────────────────────────────┤
│ SCIENTIFIC / SIMULATION                                         │
│  HEC contracts · GEOID18 educational · Quantum quarantine       │
│  Scenario Studio cascade scores (screening, not calibrated)     │
├─────────────────────────────────────────────────────────────────┤
│ EVIDENCE / GOVERNANCE                                           │
│  Merkle ledger · authority classes · resilient gage-zero      │
│  human_authorized requires reviewer identity                    │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Flood-specific data paths

### 3.1 Observed (button-only)
- USGS OGC continuous values for 03378500, 03322000, 03322420
- Reject sentinel / obs_not_current
- NAVD88 WSE **blocked** until published station conversion

### 3.2 Regulatory / planning (distinct layers)
- FEMA NFHL = effective insurance context
- Indiana BAFM = planning / Flood Control Act context
- Never merged into one “flood truth” layer

### 3.3 Scenario (Scenario Studio)
- Human selects event + adaptation
- Deterministic **relative** cascade scores on screening facilities
- Authority class **SCENARIO** / label **SIMULATION_DEMO**
- Does **not** invent flood depth grids or freeboard

### 3.4 Engineering models
- HEC-HMS → HEC-RAS reproducible manifests on approved AOI only
- Outputs COMPLETED_UNVALIDATED until independent review

## 4. Cascading impacts (Scenario Studio)

1. Event intensity (0–1 screening)
2. Facility corridor exposure weight
3. Adaptation residual factor
4. Sorted impact list + residual risk index

**Not** a substitute for HEC-RAS 2D, HAZUS, or official emergency orders.

## 5. Authority class machine rules

| Class | May drive UI | May claim regulatory effect |
|-------|--------------|------------------------------|
| OBSERVED | Yes, with timestamp | No |
| REGULATORY | Yes, labeled FEMA/IDNR | Only as pointer to official product |
| DERIVED | Yes, labeled | No |
| SCENARIO / SIMULATION_DEMO | Yes, banner required | **Never** |
| UNAVAILABLE | Explicit empty state | N/A |

## 6. Related docs

- [TSM-MATURITY-SCORECARD-2026-10-17.md](./TSM-MATURITY-SCORECARD-2026-10-17.md)
- [REPO-FINISH-CHECKLIST-2026-10-15.md](./REPO-FINISH-CHECKLIST-2026-10-15.md)
- ADR-004 Human authority · ADR-005 Four-plane · ADR-006 Agentic ladder
