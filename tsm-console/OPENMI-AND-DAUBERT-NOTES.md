# OpenMI 2.0 Coupling Contracts & Courtroom (Daubert) Standards
**TuckerInc.82 / Tri-State Systems Manager — Phase 1 Reference**  
2026-08-19

## 1. OpenMI 2.0 (OGC 11-014r3)

OpenMI 2.0 is an OGC Interface Standard that enables **runtime data exchange** between independently developed process simulation models (and between models and databases / visualization tools).

### Core Concepts Used by TSM

| Concept | OpenMI Interface | TSM Phase 1 Use |
|---------|------------------|-----------------|
| Linkable Component | `IBaseLinkableComponent` | Future HEC-RAS, MODFLOW, SWMM, Bishop wrappers |
| Exchange Item | `IBaseExchangeItem` | Described by `OpenMIExchangeItemDescriptor` in `types/loaders.ts` |
| Input | `IBaseInput` | Model requests (pull-driven) |
| Output | `IBaseOutput` | Model provides values for a quantity/quality at a place and time |
| Value Definition | `IValueDefinition` (Quantity / Quality) | Unit + value type for stage, discharge, FoS, etc. |
| Adapted Output | `IBaseAdaptedOutput` | Unit conversion, temporal interpolation, spatial mapping |

### Coupling Pattern (Future)

1. Each solver exposes a thin OpenMI-compliant wrapper.
2. A `CoupledSolverExecutionMatrix` (from the Digital Twin briefing) orchestrates who provides what to whom.
3. Data exchange is **pull-driven** (request-reply): a component asks another for values at a required time/space.
4. All exchanged values are recorded in the Evidence Ledger with SHA-256 / Merkle sealing before they can influence a human decision.

**Phase 1 status:** Metadata descriptors only. No live OpenMI runtime. Solvers remain outside the console until sealed, human-authorized integration.

---

## 2. Courtroom Standards — Daubert & Digital Simulations

### Daubert Factors (Fed. R. Evid. 702 / Daubert v. Merrell Dow)

Courts acting as gatekeepers ask whether expert testimony (including computer simulations) is:

1. **Testable** — the technique can be and has been tested  
2. **Peer-reviewed** — subjected to peer review and publication  
3. **Known / potential error rate** — quantified and acceptable  
4. **Standards exist and are maintained** — controlling the technique’s operation  
5. **Generally accepted** — in the relevant scientific community (non-exclusive)

### Implications for TSM Evidence & Models

| Requirement | TSM Implementation |
|-------------|--------------------|
| Testable | Fixed-seed deterministic runs (IEEE-754 strict, Xoshiro256++); bit-exact replay |
| Peer review | Open-source publication of methods; model cards; Data Contract Schema |
| Error rate | Explicit uncertainty / confidence scores on evidence blocks; documented validation against gauges |
| Standards | HEC-RAS, USGS, FEMA FIS, NIST AI RMF, OpenMI 2.0, Indiana Data Strategy |
| Acceptance | Use only methods already accepted in hydraulic / geotechnical practice (HEC-RAS 2D, Bishop, etc.) |
| Human expert | No autonomous output reaches a decision; every high-impact result requires human authorization and is presented through a qualified human |
| Provenance | SHA-256 + Merkle root + RFC-3161-style timestamps; full lineage graph |

### Proposed Fed. R. Evid. 707 (emerging)

Machine-generated outputs offered as expert-like evidence may be required to satisfy Rule 702 reliability findings and disclosure of design, training data, validation, and error rates. TSM’s model-card + Data Contract + human-authorization design anticipates this requirement.

---

## 3. Non-Negotiable Rules

- No simulation or AI output is admitted as a decision without a human expert who can be cross-examined.
- Site constants (BFE 375.0, LAG 377.2, FFE 382.5, CRS EPSG:2966/NAVD88) are immutable without a sealed evidence entry and human sign-off.
- OpenMI coupling, when activated, must itself be logged as an Evidence Ledger event.

---

*God First • Serve Everyone • Open Source for the Common Good*

---

## 4. Phase 1 OpenMI Coupling Contract (Metadata)

Until live solvers are sealed, TSM uses descriptor-only contracts:

```typescript
interface OpenMIExchangeItemDescriptor {
  id: string;
  caption: string;
  description: string;
  valueDefinition: { type: 'Quantity' | 'Quality'; unit?: string; valueType: string };
  spatialDefinition: string;
  temporalDefinition: string;
  providerComponentId: string;
}
```

Example future links:

| Provider | Exchange Item | Consumer |
|----------|---------------|----------|
| HEC-RAS 2D | Water surface elevation (ft NAVD88) | No-Rise Certifier |
| MODFLOW 6 | Groundwater head | Geotechnical FoS |
| USGS NWIS | Observed stage | EnKF assimilator |
| NOAA MTVI3 | Forecast stage | Cinematic / Map overlays |

All runtime exchanges MUST emit Evidence Ledger events before influencing a human decision surface.

## 5. Token Proxy & Courtroom Chain of Custody

The backend token proxy (`server/token-proxy.mjs`):

1. Holds `client_secret` server-side only.
2. Exchanges authorization codes for tokens.
3. Maps claims → `AuthContext` (uid, roles, clearance, tenant).
4. Optionally accepts authoritative ledger appends.

For Daubert packages, export:

- Merkle root + leaf list (`exportLedgerJson`)
- Auth session metadata (uid, authenticatedAt — no tokens)
- Model version / Data Contract IDs
- Human authorization records

