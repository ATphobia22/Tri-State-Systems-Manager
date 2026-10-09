# Universal Agent Capability Protocol (UACP) — implementation contract

## Purpose
UACP is the internal capability envelope for dispatching typed, policy-checked work across provider adapters and TSM domain services. It is not a claim of compatibility with an external standard.

## Request requirements
- Unique request ID and capability identifier.
- Explicit input schema/version.
- Deadline/timeout and cancellation propagation.
- Authenticated principal and authorization decision at the gateway.
- Idempotency key for retryable side effects.
- Bounded payload size and validated content type.

## Result requirements
- Typed success or typed failure; no ambiguous empty success.
- Execution and provider metadata with secrets redacted.
- Provenance and citations for evidence-producing capabilities.
- Usage/cost metadata only when provided by a trusted provider.
- Partial-result status when not all requested work was completed.

## Security
Provider names and requested capability IDs are untrusted input. Enforce an allowlist and policy decision before dispatch. Never execute arbitrary URLs, shell commands, or MCP tools solely because they appear in a request. Credentials are resolved server-side and never returned to clients.

## Reliability
Apply per-provider timeouts, bounded retries only for transient failures, concurrency limits, circuit breaking where implemented, and structured audit events. Cache keys must include provider/model version, normalized request, policy scope, and data freshness requirements.
