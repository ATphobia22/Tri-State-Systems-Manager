# TSM Capability Control Plane

The repository exposes a broad capability surface, but **availability is not equivalent to autonomous authority**.

## Policy

TSM uses:

**allow safe capability → preserve provenance → validate boundary → gate consequential action → require human/professional approval**

The control plane is machine-readable at `integrations/registry/tsm-capability-control-plane.json`.

### ENABLED

Safe evidence, ingestion, analysis, visualization, operations, security, provenance and CI capabilities are available to the application and verification pipeline.

### GATED

Capabilities that can create external regulatory effects, licensed artifacts, research-state mutation, native execution, desktop release actions, or consequential agent behavior remain available behind explicit gates.

This includes:

- FEMA/LOMA external filing;
- regulatory submissions;
- S2 agent assistance;
- quantum optimization;
- native Archimedes runtime;
- licensed CityEngine/Unreal generation;
- desktop release actions.

## Non-negotiable boundaries

- No automatic FEMA/LOMA filing.
- No automatic regulatory determination.
- No automatic evidence-ledger acceptance.
- No TSM model output becomes a survey, FEMA certification, or legal conclusion.
- Community observations remain quarantined observations.
- Research/quantum outputs cannot mutate authoritative regulatory state.
- Presentation imagery cannot become authoritative engineering geometry.
- Hashes/attestations prove integrity/provenance, not legal admissibility.

## Verification

`scripts/ci/validate-capability-control-plane.mjs` is fail-closed and runs from the canonical `npm run ci` chain.
