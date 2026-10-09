# Skill: UACF Provider Adapter Contract

## Trigger
Use when adding or changing an external model, search, browser, geospatial, OpenAPI, or MCP provider.

## Procedure
1. Implement the shared capability contract; do not bypass authorization, request context, trace identifiers, or normalized result envelopes.
2. Validate input type, size, and permitted capability before network I/O.
3. Read credentials from explicit configuration or environment variables; never commit secrets or place keys in browser bundles.
4. Apply bounded timeouts, abort support, and normalized retryability for rate limits, server failures, and transport errors.
5. Parse provider responses defensively; reject malformed or empty outputs.
6. Emit provenance for successful outputs and trace-linked failures for unsuccessful calls.
7. Unit-test request method, endpoint, headers, body, parsing, missing credentials, timeouts, rate limiting, oversized input, and malformed payloads using mocked fetch.
8. Keep live-provider integration tests opt-in and secret-gated; the default test suite must not incur charges or require external credentials.

## Release criteria
Typecheck, unit tests, provider boundary tests, secret scanning, and policy checks must pass. A healthy configuration indicator does not prove external service availability or provider correctness.
