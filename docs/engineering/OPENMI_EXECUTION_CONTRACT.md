# OpenMI-style gRPC Execution Contract

TSM uses a TSM-owned protobuf transport profile for OpenMI-style exchanges. The protobuf API does not itself establish OpenMI 2.0 conformance.

## Mandatory metadata
Every value set identifies quantity and exact unit, timestamp/time semantics, source and target component, model run ID, provenance hash, horizontal CRS, horizontal coordinate units, vertical datum, vertical units, software/model versions, and validation state. Spatial and vertical references are not inferred from a single EPSG code.

## RPC lifecycle
- Clients set an explicit finite gRPC deadline for every call.
- Server code respects cancellation through context.is_active() and task cancellation. On cancellation, stop the reader and unsubscribe the stream; do not publish success for partial output.
- Deadline expiry is TIMEOUT; client cancellation is CANCELLED; invalid metadata is DATA_ERROR; unit mismatch is UNIT_MISMATCH; CRS/datum mismatch is DATUM_MISMATCH; solver non-convergence is NON_CONVERGENT.
- accepted=true means transport validation only, never solver convergence.
- Automatic retries are prohibited for non-idempotent operations. Retried exchanges need a stable idempotency/run identifier.

## Temporal semantics
Use INSTANT, INTERVAL_MEAN, INTERVAL_SUM, or STATE_AT_STEP. Timestamp values must have an explicit timezone offset. Interval values require interval duration and convention. Stale/future telemetry is rejected under a configured policy; no interpolation or extrapolation occurs.

## Production security
The current development listener uses insecure gRPC and must not be exposed to untrusted networks. Production requires TLS/mTLS or an authenticated service mesh, component authorization, message-size/rate limits, audit logging, and managed key/secret lifecycle. Documentation does not enable these controls.
