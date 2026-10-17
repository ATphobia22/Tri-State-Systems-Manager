# TSM maturity scorecard (ISO/IEC 30186-inspired)

**Date:** 2026-10-17 · **Self-assessment** (not BSI Kitemark / not certified)

Aspects follow the spirit of ISO/IEC 30186 (Convergence, Capability, Integrated view, Time, Trustworthiness). Scores are evidence-based for the **public console + evidence plane**, not aspirational Level-5 claims.

| Aspect | Level (1–5) | Evidence | Next honest step |
|--------|-------------|----------|------------------|
| **Convergence** | 2–3 | On-demand USGS; static FEMA/BAFM; no bidirectional control | Opt-in session streams with stale clocks |
| **Capability** | 2–3 | Monitoring + scenario screening + HEC contracts | Predictive packs on **approved** AOI only |
| **Integrated view** | 2–3 | Twin Canvas multi-layer; dams registry; Scenario Studio cascade | Cascading sector layers with tenant isolation |
| **Time** | 2 | Button fetch timestamps; scenario runAt | Event timelines; not continuous 4D default |
| **Trustworthiness** | **4** | Fail-closed gage-zero; authority classes; Merkle; human_authorized | Publish third-party assessment if desired |

**Explicit non-scores:** Autonomous capability (Level 5) = **out of scope by ADR**.

## Product posture

- Digital **shadow + scenario workspace**, not autonomous twin
- Not LOD4, not continuous live 4D product claim
- Innovation proceeds **above** the trust bar, not by removing it
