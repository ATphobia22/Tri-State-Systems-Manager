# Scientific Execution Trust Boundary

## Status and scope
This fail-closed evidence runtime verifies artifacts supplied by solver adapters; it does not install, launch, or certify HEC-RAS, MODFLOW 6, or a slope-stability solver. A transport response or process exit code is not proof of numerical convergence.

## Execution states
- NOT_EVALUATED: required evidence or validation is missing.
- VERIFIED: output artifacts exist and hash correctly, explicit positive convergence evidence is supplied by an adapter, and no validation messages remain.
- FAILED, TIMEOUT, CANCELLED, NON_CONVERGENT: preserve the observed failure state.
- DATA_ERROR, UNIT_MISMATCH, DATUM_MISMATCH: block exchange/gate evaluation.
- GATE_BLOCKED_BY_SOLVER_ERROR: downstream governance cannot evaluate a failed or missing upstream simulation.

VERIFIED is technical artifact verification only, not physical validation, regulatory compliance, PE/LS certification, a permit, or legal admissibility.

## Solver evidence requirements
### HEC-RAS
Record project/plan identifiers, input hashes, actual HDF output, computation messages/logs, requested profiles/time windows, and HDF dataset inventory. An HDF file existing is necessary but insufficient. The adapter must inspect required result datasets and independently parse convergence and fatal messages. Ambiguous/missing evidence results in NOT_EVALUATED or FAILED.

### MODFLOW 6
Record name file/package inputs, executable/version identity, listing output, head files, cell-budget files, convergence status, and mass-balance report. A non-empty HDS or CBC file alone is not proof of convergence. Apply a documented project-specific mass-balance tolerance. Missing binary/output, non-convergence, or unverified mass balance blocks downstream coupling.

### Slope stability
TSM contains a Bishop simplified-method calculation in backend/solvers/geotech.py. Capture method version, input hash, geometry/slice inputs, material parameters, pore-pressure inputs, factor of safety, iteration count, convergence state, and result status. A factor of safety without geometry/material provenance is not a verified engineering result. This is an advisory screen, not professional review.

## OpenMI-style gRPC transport
TSM uses a TSM-owned protobuf transport profile; this is not by itself proof of OpenMI 2.0 conformance. Each exchange needs quantity, exact unit, timestamp and time semantics, source component, model run, provenance hash, horizontal CRS, vertical datum, coordinate units, software/model versions, and validation state. No implicit unit/datum conversion is allowed. Clients must set finite RPC deadlines; the service must honor cancellation and stop request processing. Timeout/cancellation cannot be converted into success. Retry only explicitly idempotent operations keyed by stable run/exchange ID.

## Durable evidence and signatures
backend/engineering_evidence.py provides a local SQLite append-only ledger, per-artifact SHA-256, canonical evidence hashes, hash-chain verification, metadata freshness checks, and Ed25519 signature verification. It does not sign, approve, or authorize artifacts. Production should use PostgreSQL migration, append-only roles, backups, and managed public-key trust anchors. A valid signature proves a key signed bytes; it does not prove signer authority or scientific correctness.

## Spatial, temporal, and unit discipline
- Timestamps must have an explicit UTC offset.
- Stale telemetry is rejected; no interpolation or extrapolation occurs.
- Units must match exactly unless a separately tested conversion names source and target units, implementation, and uncertainty.
- Horizontal CRS and vertical datum are distinct; horizontal EPSG alone does not establish vertical datum.
- Stage is not elevation. Conversion requires verified gage datum, target datum, units, method, and applicable epoch; missing any field blocks conversion.

## Replay, tamper evidence, and approvals
Evidence hashes use canonical JSON with sorted keys and reject NaN/Infinity. Replay comparisons record model/software versions, input/config hashes, runtime identity, and output comparison method. Bitwise identity is not assumed for all numerical solvers; tolerance-based equivalence must document metric/tolerance. The PostgreSQL migration defines evidence, signature, and replay records. A hash is not a signature. A signature is not approval. Production approval must authenticate signer, check authority and key validity/revocation, retain signed bytes/signature envelope, and record the human approval event. Regulatory decisions remain with qualified reviewers and the relevant authority.
