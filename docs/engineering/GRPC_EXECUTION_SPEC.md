# gRPC Execution Specification

## Contract

`tsm-console/proto/engineering.proto` (`tsm.engineering.v1`) defines
`SimulationRequest` (run id, CRS, units, model hash, deadline, solver name
and version) and `SimulationResponse` (run id, status, evidence bundle
hash, duration, failure detail).

**This is a contract file only.** It does not claim a running execution
service. The live transport boundary is the existing `tsm.openmi.v1`
service in `backend/openmi_service.py`. A future execution service would
implement this contract.

## Required runtime features

Deadlines (propagated, not ignored), cancellation, timeout, retry only on
explicitly retryable failures, streaming logs, and the shared failure
states: `FAILED`, `TIMEOUT`, `CANCELLED`, `NON_CONVERGENT`, `DATA_ERROR`,
`UNIT_MISMATCH`, `DATUM_MISMATCH`, `VERIFIED`, `UNAVAILABLE`.

## Failure semantics

A failed run still yields a response with its failure status and an
evidence bundle hash when one exists. The transport never blocks a caller
on a solver failure (resilient policy) and never fabricates outputs to
fill a failed run. Success is proven by output artifacts and validation,
never by a process exit code.

## Metadata preserved across the boundary

CRS (EPSG + vertical datum), units, model hash, solver name/version, and
the evidence bundle hash travel with every request and response. A
response that drops any of them is `DATA_ERROR`.
