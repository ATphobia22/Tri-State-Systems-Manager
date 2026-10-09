# Universal Agent Capability Protocol (UACP) — DRAFT v0.1

**Status:** DRAFT. This document describes intent, not a ratified standard.
Nothing here is implemented beyond the UACF core contracts in `packages/`.

## 1. Purpose

UACP defines how a capability is described, requested, authorized, executed,
and attested inside the Universal Agent Capability Fabric (UACF), with
provenance that survives the round trip.

## 2. Capability definition

A capability is a machine-readable contract:

```json
{
  "id": "system.local.generate",
  "version": "1.0.0",
  "inputSchema": { "type": "object" },
  "outputSchema": { "type": "object" },
  "permissions": [],
  "tags": []
}
```

Capability IDs are namespaced (`<domain>.<name>.<verb>`). Definitions are
immutable once published; changes require a new version.

## 3. Execution lifecycle

```text
request -> route -> authorize -> execute -> attest
```

1. **Request:** caller submits input plus a context carrying `requestId`.
2. **Route:** the router selects a provider that supports the capability.
3. **Authorize:** the policy engine decides allow/deny with a reason.
4. **Execute:** the provider runs behind the worker boundary (allowlisted
   entry point, timeout, byte limits, hashed I/O envelope).
5. **Attest:** the result carries a provenance envelope (input/output
   SHA-256, provider id/version, traceId, timestamps) plus citations.

The caller's `requestId` is preserved as the result `traceId` for
distributed-tracing correlation; providers generate a UUID only when no
`requestId` is supplied.

## 4. Provenance envelope

Every result includes:

- `traceId` (correlated to the request)
- `provider.providerId` + `version` + `attempt`
- input/output SHA-256 hashes
- `events[]` (started/completed markers with timestamps)
- `citations[]` and `usage{}`

## 5. Failure semantics

- Unconfigured providers throw fail-closed; they never fabricate output.
- Policy denial returns a reason, not a silent refusal.
- Timeouts, oversized payloads, and hash mismatches are failures, not
  fallbacks.
- Missing data is reported as unavailable, never synthesized.

## 6. Open questions (v0.2)

- Capability discovery and versioning negotiation.
- Multi-provider fan-out and result reconciliation policy.
- Formal schema (JSON Schema / protobuf) for the envelope.
