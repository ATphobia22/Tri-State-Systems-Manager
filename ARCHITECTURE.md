# TSM / UACF Architecture

## System boundaries
- `apps/uacf-gateway`: HTTP/API boundary and request lifecycle.
- `packages/core`: execution context, lifecycle, cancellation, and agent session contracts.
- `packages/router`: capability and provider selection policies.
- `packages/provider-runtime` and `providers/*`: provider adapters behind explicit interfaces.
- `packages/evidence`, `packages/provenance`, and `packages/artifacts`: source lineage and immutable evidence metadata.
- `packages/geo`, `packages/hydraulics`, and `packages/twin*`: geospatial and digital-twin domain capabilities.
- `tsm-console`: existing user-facing console and production geospatial pipeline.

## Reliability principles
1. Validate untrusted input at the boundary.
2. Apply timeouts and cancellation to external calls.
3. Keep credentials out of logs and source control.
4. Fail closed for authorization, evidence integrity, datum ambiguity, and artifact integrity.
5. Use explicit status types for partial results; do not convert missing evidence into synthetic observations.
6. Cache only with a key that includes source, version, relevant parameters, and policy context.
7. Persist provenance for derived outputs and bind releases to commit and data-manifest hashes.

## Workspace
The repository currently uses npm workspaces and TypeScript project configuration. Continue using the existing package manager and lockfile; do not introduce a competing pnpm lock/workspace until a deliberate migration is approved.
